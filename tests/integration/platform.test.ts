import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sysDb, withTenant } from "@/lib/db";
import { provisionTenant } from "@/lib/services/tenants";
import { importCatalog } from "@/lib/services/catalog-import";
import { importStudents } from "@/lib/services/student-import";
import { checkout, returnBook, waiveFine, requestExtension, decideExtension } from "@/lib/services/circulation";
import { registerStudent } from "@/lib/services/accounts";
import { runDailyFines, runReminders, runTelemetry } from "@/lib/services/jobs";
import { createShift, publishRoster } from "@/lib/services/roster";
import { flushOutbox } from "@/lib/mail/outbox";

const run = Math.random().toString(36).slice(2, 8);
const db = sysDb();

interface T { id: string; code: string; name: string; adminId: string; main: string; sci: string }
let A: T, B: T, actor: string;

async function mkTenant(label: string, extra: Partial<{ tier: "FREE" | "STANDARD" | "ENTERPRISE" }> = {}): Promise<T> {
  const code = `t-${label}-${run}`;
  const t = await provisionTenant(actor, { name: `School ${label}`, code, tier: extra.tier ?? "STANDARD", adminEmail: `admin-${label}-${run}@example.test`, adminName: `Admin ${label}`, allowedEmailDomains: [`${label}.edu`] });
  const admin = await db.user.findFirstOrThrow({ where: { tenantId: t.id, role: "TENANT_ADMIN" } });
  const main = await db.branch.findFirstOrThrow({ where: { tenantId: t.id, code: "MAIN" } });
  const sci = await db.branch.create({ data: { tenantId: t.id, name: "Science Library", code: "SCI" } });
  return { id: t.id, code, name: t.name, adminId: admin.id, main: main.id, sci: sci.id };
}

beforeAll(async () => {
  const su = await db.user.create({ data: { role: "SUPER_ADMIN", email: `root-${run}@example.test`, fullName: "Root", passwordHash: "!x" } });
  actor = su.id;
  A = await mkTenant("a");
  B = await mkTenant("b");
});

afterAll(async () => {
  await db.tenant.deleteMany({ where: { code: { endsWith: `-${run}` } } });
  await db.user.deleteMany({ where: { id: actor } });
  await db.$disconnect();
});

const books = `title,author,category,isbn,branch_code,copies,barcode
Clean Code,Robert Martin,Software,978-0-13-235088-4,MAIN,2,
Dune,Frank Herbert,Fiction,,SCI,1,DUNE-001
,NoTitle,Fiction,,MAIN,1,
Bad Isbn,Someone,Fiction,9780134685992,MAIN,1,
Ghost Branch,Someone,Fiction,,NOPE,1,
Dup Barcode,Someone,Fiction,,MAIN,1,DUNE-001
`;

describe("tenant isolation (Postgres RLS)", () => {
  it("provisioning created branch, default policy and invite email", async () => {
    expect(await db.borrowPolicy.count({ where: { tenantId: A.id } })).toBe(1);
    expect(await db.emailOutbox.count({ where: { tenantId: A.id, kind: "INVITE" } })).toBe(1);
  });

  it("a tenant transaction only sees its own rows", async () => {
    const seenByA = await withTenant(A.id, (tx) => tx.branch.findMany());
    expect(seenByA.every((b) => b.tenantId === A.id)).toBe(true);
    expect(seenByA).toHaveLength(2);
    const other = await withTenant(A.id, (tx) => tx.branch.findUnique({ where: { id: B.main } }));
    expect(other).toBeNull();
  });

  it("cannot write rows for another tenant", async () => {
    await expect(withTenant(A.id, (tx) => tx.branch.create({ data: { tenantId: B.id, name: "Evil", code: "EVIL" } }))).rejects.toThrow();
  });

  it("the app role sees nothing when no tenant context is set", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const raw = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    expect(await raw.branch.count()).toBe(0);
    expect(await raw.user.count()).toBe(0);
    await raw.$disconnect();
  });
});

describe("catalog CSV import", () => {
  it("dry run reports line-accurate errors and writes nothing", async () => {
    const r = await withTenant(A.id, (tx) => importCatalog(tx, { tenantId: A.id, actorId: A.adminId, csv: books, dryRun: true }));
    expect(r.dryRun).toBe(true);
    expect(r.errors.map((e) => [e.line, e.field])).toEqual([[4, "title"], [5, "isbn"], [6, "branch_code"], [7, "barcode"]]);
    expect(await db.bookCopy.count({ where: { tenantId: A.id } })).toBe(0);
  });

  it("imports valid rows, generates barcodes, and links copies to catalog items", async () => {
    const r = await withTenant(A.id, (tx) => importCatalog(tx, { tenantId: A.id, actorId: A.adminId, csv: books }));
    expect(r).toMatchObject({ newItems: 2, newCopies: 3, validRows: 2 });
    const copies = await db.bookCopy.findMany({ where: { tenantId: A.id }, include: { catalogItem: true } });
    expect(copies).toHaveLength(3);
    expect(copies.filter((c) => c.catalogItem.title === "Clean Code")).toHaveLength(2);
    expect(copies.find((c) => c.barcode === "DUNE-001")?.homeBranchId).toBe(A.sci);
  });

  it("re-importing the same ISBN adds copies to the existing item instead of duplicating it", async () => {
    await withTenant(A.id, (tx) => importCatalog(tx, { tenantId: A.id, actorId: A.adminId, csv: "title,author,category,isbn,branch_code\nClean Code (reprint),R. Martin,Software,9780132350884,MAIN\n" }));
    expect(await db.catalogItem.count({ where: { tenantId: A.id, isbn: "9780132350884" } })).toBe(1);
    expect(await db.bookCopy.count({ where: { tenantId: A.id } })).toBe(4);
  });

  it("the same barcode may exist in two different schools", async () => {
    await withTenant(B.id, (tx) => importCatalog(tx, { tenantId: B.id, actorId: B.adminId, csv: "title,author,category,branch_code,barcode\nDune,Frank Herbert,Fiction,MAIN,DUNE-001\n" }));
    expect(await db.bookCopy.count({ where: { barcode: "DUNE-001", tenantId: { in: [A.id, B.id] } } })).toBe(2);
  });

  it("enforces the book license and imports nothing when over the cap", async () => {
    await db.tenant.update({ where: { id: A.id }, data: { maxBooks: 6 } });
    const csv = "title,author,category,branch_code,copies\nOverflow,X,Y,MAIN,5\n";
    await expect(withTenant(A.id, (tx) => importCatalog(tx, { tenantId: A.id, actorId: A.adminId, csv }))).rejects.toMatchObject({ code: "LICENSE_LIMIT_BOOKS" });
    expect(await db.bookCopy.count({ where: { tenantId: A.id } })).toBe(4);
    await db.tenant.update({ where: { id: A.id }, data: { maxBooks: 2000 } });
  });
});

describe("students: import, self-registration, licensing", () => {
  it("bulk import maps columns/aliases, rejects duplicates, and queues invites", async () => {
    const csv = `Student ID,Email,Name,Grade,Mobile,Type
S001,ann-${run}@a.edu,Ann Lee,Year 7,0123,UNDERGRAD
S002,bob-${run}@a.edu,Bob Tan,Year 8,,
S001,dup-${run}@a.edu,Dup Id,Year 8,,
S004,not-an-email,Bad Email,Year 8,,
S005,ann-${run}@a.edu,Dup Email,Year 8,,
`;
    const r = await withTenant(A.id, (tx) => importStudents(tx, { tenantId: A.id, tenantName: A.name, actorId: A.adminId, csv }));
    expect(r.created).toBe(2);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5, 6]);
    const ann = await db.user.findFirstOrThrow({ where: { tenantId: A.id, studentId: "S001" } });
    expect(ann).toMatchObject({ department: "Year 7", studentType: "UNDERGRAD", status: "ACTIVE" });
    expect(ann.passwordHash.startsWith("!")).toBe(true);
    expect(await db.passwordToken.count({ where: { userId: ann.id } })).toBe(1);
  });

  it("refuses an email that already exists in ANOTHER school, without saying which", async () => {
    const r = await withTenant(B.id, (tx) => importStudents(tx, { tenantId: B.id, tenantName: B.name, actorId: B.adminId, csv: `student_id,email,full_name\nX1,ann-${run}@a.edu,Ann Again\n` }));
    expect(r.created).toBe(0);
    expect(r.errors[0].message).toBe("an account with this email already exists");
  });

  it("self-registration: matching email domain + auto-approve => ACTIVE, otherwise pending queue", async () => {
    await db.tenant.update({ where: { id: A.id }, data: { autoApproveStudents: true } });
    const base = { tenantCode: A.code, password: "correct-horse-battery", fullName: "Reg User", department: "Y9" };
    expect((await registerStudent({ ...base, email: `reg1-${run}@a.edu`, studentId: "R1" })).status).toBe("ACTIVE");
    expect((await registerStudent({ ...base, email: `reg2-${run}@gmail.test`, studentId: "R2" })).status).toBe("PENDING_VERIFICATION");
    await expect(registerStudent({ ...base, email: `reg3-${run}@a.edu`, studentId: "R1" })).rejects.toMatchObject({ code: "ALREADY_REGISTERED" });
    await expect(registerStudent({ ...base, tenantCode: "nope", email: `x-${run}@a.edu`, studentId: "R9" })).rejects.toMatchObject({ code: "UNKNOWN_SCHOOL" });
  });

  it("enforces the student license for registrations", async () => {
    const used = await db.user.count({ where: { tenantId: A.id, role: "STUDENT" } });
    await db.tenant.update({ where: { id: A.id }, data: { maxStudents: used } });
    await expect(registerStudent({ tenantCode: A.code, password: "correct-horse-battery", fullName: "Late", email: `late-${run}@a.edu`, studentId: "L1" })).rejects.toMatchObject({ code: "LICENSE_LIMIT_STUDENTS" });
    await db.tenant.update({ where: { id: A.id }, data: { maxStudents: 500 } });
  });
});

describe("circulation", () => {
  const ctx = () => ({ tenantId: A.id, actorId: A.adminId });
  let cleanCode: string[];

  beforeAll(async () => {
    cleanCode = (await db.bookCopy.findMany({ where: { tenantId: A.id, catalogItem: { title: "Clean Code" } }, select: { barcode: true }, orderBy: { barcode: "asc" } })).map((c) => c.barcode);
  });

  it("checks out with a policy-derived due date and blocks double checkout", async () => {
    const r = await withTenant(A.id, (tx) => checkout(tx, { ...ctx(), branchId: A.main, barcode: cleanCode[0], borrower: "S001" }));
    expect(r.title).toBe("Clean Code");
    const days = (r.loan.dueDate.getTime() - r.loan.borrowedAt.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(14);
    expect(days).toBeLessThan(15);
    await expect(withTenant(A.id, (tx) => checkout(tx, { ...ctx(), branchId: A.main, barcode: cleanCode[0], borrower: "S002" }))).rejects.toMatchObject({ code: "COPY_UNAVAILABLE" });
  });

  it("two simultaneous checkouts of one copy: exactly one wins", async () => {
    const code = cleanCode[1];
    const results = await Promise.allSettled(["S002", "R1"].map((b) => withTenant(A.id, (tx) => checkout(tx, { ...ctx(), branchId: A.main, barcode: code, borrower: b }))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.loan.count({ where: { bookCopy: { barcode: code }, returnedAt: null } })).toBe(1);
  });

  it("cross-branch return moves the CURRENT location only; home stays and BRANCH_RETURN is audited", async () => {
    const r = await withTenant(A.id, (tx) => returnBook(tx, { ...ctx(), branchId: A.sci, barcode: cleanCode[0] }));
    expect(r.crossBranch).toBe(true);
    const copy = await db.bookCopy.findFirstOrThrow({ where: { tenantId: A.id, barcode: cleanCode[0] } });
    expect(copy).toMatchObject({ homeBranchId: A.main, currentBranchId: A.sci, status: "AVAILABLE" });
    const loan = await db.loan.findFirstOrThrow({ where: { bookCopyId: copy.id } });
    expect(loan).toMatchObject({ checkoutBranchId: A.main, returnedBranchId: A.sci, status: "RETURNED" });
    expect(await db.auditLog.count({ where: { tenantId: A.id, action: "BRANCH_RETURN" } })).toBe(1);
    await expect(withTenant(A.id, (tx) => returnBook(tx, { ...ctx(), branchId: A.sci, barcode: cleanCode[0] }))).rejects.toMatchObject({ code: "NOT_ON_LOAN" });
  });

  it("enforces max concurrent loans per policy (student type specific)", async () => {
    await db.borrowPolicy.create({ data: { tenantId: A.id, name: "Undergrad", studentType: "UNDERGRAD", isDefault: false, maxLoansPerUser: 1 } });
    // S001 is UNDERGRAD, has 0 open loans now (returned). First succeeds, second hits the limit.
    await withTenant(A.id, (tx) => checkout(tx, { ...ctx(), branchId: A.sci, barcode: cleanCode[0], borrower: "S001" }));
    await expect(withTenant(A.id, (tx) => checkout(tx, { ...ctx(), branchId: A.sci, barcode: "DUNE-001", borrower: "S001" }))).rejects.toMatchObject({ code: "LOAN_LIMIT" });
  });

  it("extension requests: request -> approve moves the due date by renewalDays, and only once", async () => {
    const loan = await db.loan.findFirstOrThrow({ where: { tenantId: A.id, returnedAt: null, user: { studentId: "S001" } } });
    const req = await withTenant(A.id, (tx) => requestExtension(tx, { tenantId: A.id, userId: loan.userId, loanId: loan.id, reason: "exam week" }));
    await expect(withTenant(A.id, (tx) => requestExtension(tx, { tenantId: A.id, userId: loan.userId, loanId: loan.id }))).rejects.toMatchObject({ code: "ALREADY_REQUESTED" });
    await withTenant(A.id, (tx) => decideExtension(tx, { ...ctx(), requestId: req.id, approve: true }));
    const after = await db.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(after.renewalCount).toBe(1);
    expect(Math.round((after.dueDate.getTime() - loan.dueDate.getTime()) / 86_400_000)).toBe(7);
    await expect(withTenant(A.id, (tx) => requestExtension(tx, { tenantId: A.id, userId: loan.userId, loanId: loan.id }))).rejects.toMatchObject({ code: "RENEWAL_LIMIT" });
  });
});

describe("fines, reminders, jobs", () => {
  it("daily job accrues fines idempotently, blocks the account at the threshold, and a waiver sticks", async () => {
    const student = await db.user.findFirstOrThrow({ where: { tenantId: A.id, studentId: "S002" } });
    const copy = await db.bookCopy.findFirstOrThrow({ where: { tenantId: A.id, barcode: "DUNE-001" } });
    const now = new Date();
    const due = new Date(now.getTime() - 30 * 86_400_000);
    const loan = await db.loan.create({ data: { tenantId: A.id, bookCopyId: copy.id, userId: student.id, checkoutBranchId: A.sci, borrowedAt: new Date(due.getTime() - 14 * 86_400_000), dueDate: due } });
    await db.bookCopy.update({ where: { id: copy.id }, data: { status: "CHECKED_OUT" } });

    await runDailyFines(now);
    await runDailyFines(now); // second run must not double-charge
    const fine = await db.fine.findUniqueOrThrow({ where: { loanId: loan.id } });
    expect(fine.daysOverdue).toBe(29); // 30 late - 1 grace
    expect(fine.amount.toString()).toBe("14.5"); // 29 * 0.50
    expect(await db.fine.count({ where: { loanId: loan.id } })).toBe(1);

    // 14.50 >= threshold 10.00 => blocked
    await expect(withTenant(A.id, (tx) => checkout(tx, { tenantId: A.id, actorId: A.adminId, branchId: A.main, barcode: "NOPE", borrower: "S002" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    const free = await db.bookCopy.findFirstOrThrow({ where: { tenantId: A.id, status: "AVAILABLE" } });
    await expect(withTenant(A.id, (tx) => checkout(tx, { tenantId: A.id, actorId: A.adminId, branchId: A.main, barcode: free.barcode, borrower: "S002" }))).rejects.toMatchObject({ code: "FINES_BLOCK" });

    await withTenant(A.id, (tx) => waiveFine(tx, { tenantId: A.id, actorId: A.adminId, fineId: fine.id, reason: "Medical leave" }));
    await runDailyFines(new Date(now.getTime() + 5 * 86_400_000));
    expect((await db.fine.findUniqueOrThrow({ where: { id: fine.id } })).status).toBe("WAIVED");
    expect((await db.fine.findUniqueOrThrow({ where: { id: fine.id } })).amount.toString()).toBe("14.5");
    expect(await db.auditLog.count({ where: { tenantId: A.id, action: "FINE_WAIVED" } })).toBe(1);

    // Now unblocked
    const ok = await withTenant(A.id, (tx) => checkout(tx, { tenantId: A.id, actorId: A.adminId, branchId: A.main, barcode: free.barcode, borrower: "S002" }));
    expect(ok.loan.id).toBeTruthy();
  });

  it("reminders: marks overdue, emails once per event, and is safe to re-run", async () => {
    const before = await db.emailOutbox.count({ where: { tenantId: A.id, kind: { in: ["DUE_SOON", "OVERDUE"] } } });
    await runReminders();
    const after1 = await db.emailOutbox.count({ where: { tenantId: A.id, kind: { in: ["DUE_SOON", "OVERDUE"] } } });
    await runReminders();
    const after2 = await db.emailOutbox.count({ where: { tenantId: A.id, kind: { in: ["DUE_SOON", "OVERDUE"] } } });
    expect(after1).toBeGreaterThan(before);
    expect(after2).toBe(after1);
    expect(await db.loan.count({ where: { tenantId: A.id, status: "OVERDUE" } })).toBeGreaterThan(0);
  });

  it("outbox worker sends pending mail, scrubs tokens, and does not resend", async () => {
    const first = await flushOutbox(500);
    expect(first.sent).toBeGreaterThan(0);
    expect(await db.emailOutbox.count({ where: { status: "PENDING", attempts: { lt: 5 }, tenantId: { in: [A.id, B.id] } } })).toBe(0);
    expect((await db.emailOutbox.findFirstOrThrow({ where: { tenantId: A.id, kind: "INVITE", status: "SENT" } })).body).toBe("[redacted after delivery]");
    expect((await flushOutbox(500)).sent).toBe(0);
  });

  it("telemetry snapshot records usage and storage", async () => {
    await runTelemetry();
    const s = await db.usageSnapshot.findFirstOrThrow({ where: { tenantId: A.id } });
    expect(s.students).toBeGreaterThan(0);
    expect(s.bookCopies).toBe(4);
    expect(Number(s.storageBytes)).toBeGreaterThan(0);
  });
});

describe("librarian roster", () => {
  it("rejects overlapping shifts, and publishing sends one digest per librarian", async () => {
    const lib = await db.user.create({ data: { tenantId: A.id, role: "LIBRARIAN", email: `lib-${run}@a.edu`, fullName: "Lib Rarian", passwordHash: "!x" } });
    const day = (h: number) => new Date(Date.UTC(2031, 0, 6, h));
    const c = { tenantId: A.id, actorId: A.adminId };
    await withTenant(A.id, (tx) => createShift(tx, { ...c, input: { branchId: A.main, librarianId: lib.id, startTime: day(8), endTime: day(12) } }));
    await withTenant(A.id, (tx) => createShift(tx, { ...c, input: { branchId: A.sci, librarianId: lib.id, startTime: day(13), endTime: day(17) } }));
    await expect(withTenant(A.id, (tx) => createShift(tx, { ...c, input: { branchId: A.sci, librarianId: lib.id, startTime: day(11), endTime: day(14) } }))).rejects.toMatchObject({ code: "SHIFT_OVERLAP" });

    const r = await withTenant(A.id, (tx) => publishRoster(tx, { ...c, from: day(0), to: day(23) }));
    expect(r).toEqual({ published: 2, notified: 1 });
    const mails = await db.emailOutbox.findMany({ where: { tenantId: A.id, kind: "SHIFT_PUBLISHED", toEmail: lib.email } });
    expect(mails).toHaveLength(1);
    expect(mails[0].body).toContain("Science Library");
    expect((await withTenant(A.id, (tx) => publishRoster(tx, { ...c, from: day(0), to: day(23) })))).toEqual({ published: 0, notified: 0 });
  });
});
