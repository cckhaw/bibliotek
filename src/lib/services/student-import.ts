import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Tx } from "../db";
import { sysDb } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { capErrors, clean, parseCsv, type RowError } from "../csv";
import { newToken, sha256, unusablePasswordHash } from "../auth/password";
import { enqueueEmails } from "../mail/outbox";
import { invite } from "../mail/templates";
import { assertCapacity } from "./licensing";

/** Columns: student_id*, email*, full_name*, department (or grade), phone, student_type */
const ALIASES: Record<string, string> = {
  id: "student_id", studentid: "student_id", student_number: "student_id", name: "full_name", fullname: "full_name",
  grade: "department", grade_department: "department", class: "department", dept: "department",
  mobile: "phone", contact: "phone", contact_number: "phone", type: "student_type", email_address: "email",
};

const rowSchema = z.object({
  student_id: z.string().min(1, "student_id is required").max(64),
  email: z.string().email("email is not valid").max(254).transform((e) => e.toLowerCase()),
  full_name: z.string().min(1, "full_name is required").max(200),
  department: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  student_type: z.string().max(40).optional().transform((v) => v?.toUpperCase()),
});

const INVITE_TTL_MS = 7 * 24 * 3600_000;

export interface StudentImportResult {
  dryRun: boolean; totalRows: number; created: number; errors: RowError[]; errorCount: number; truncated: boolean;
}

export async function importStudents(
  tx: Tx,
  a: { tenantId: string; tenantName: string; actorId: string; csv: string; dryRun?: boolean; ip?: string | null },
): Promise<StudentImportResult> {
  const { rows, structuralErrors } = parseCsv(a.csv, { required: ["student_id", "email", "full_name"], aliases: ALIASES });
  const errors: RowError[] = [...structuralErrors];
  const bad = new Set(structuralErrors.map((e) => e.line));

  const ok: (z.infer<typeof rowSchema> & { line: number })[] = [];
  const seenEmail = new Map<string, number>();
  const seenId = new Map<string, number>();

  for (const { line, record } of rows) {
    if (bad.has(line)) continue;
    const p = rowSchema.safeParse(Object.fromEntries(Object.entries(record).map(([k, v]) => [k, clean(v as string)])));
    if (!p.success) { for (const i of p.error.issues) errors.push({ line, field: String(i.path[0] ?? ""), message: i.message }); continue; }
    const d = p.data;
    if (seenEmail.has(d.email)) { errors.push({ line, field: "email", message: `duplicate of line ${seenEmail.get(d.email)}` }); continue; }
    if (seenId.has(d.student_id)) { errors.push({ line, field: "student_id", message: `duplicate of line ${seenId.get(d.student_id)}` }); continue; }
    seenEmail.set(d.email, line); seenId.set(d.student_id, line);
    ok.push({ ...d, line });
  }

  // Emails are unique platform-wide. RLS hides other tenants' users from `tx`, so existence is checked with the
  // system client. The message is deliberately generic so it does not disclose which school holds the address.
  const takenEmails = new Set((await sysDb().user.findMany({ where: { email: { in: ok.map((r) => r.email) } }, select: { email: true } })).map((u) => u.email));
  const takenIds = new Set((await tx.user.findMany({ where: { studentId: { in: ok.map((r) => r.student_id) } }, select: { studentId: true } })).map((u) => u.studentId));
  const accepted = ok.filter((r) => {
    if (takenEmails.has(r.email)) { errors.push({ line: r.line, field: "email", message: "an account with this email already exists" }); return false; }
    if (takenIds.has(r.student_id)) { errors.push({ line: r.line, field: "student_id", message: "student_id already exists in this school" }); return false; }
    return true;
  });

  const result = (created: number): StudentImportResult => ({
    dryRun: !!a.dryRun, totalRows: rows.length, created, ...capErrors(errors.sort((x, y) => x.line - y.line)),
  });
  if (a.dryRun || accepted.length === 0) return result(a.dryRun ? accepted.length : 0);

  await assertCapacity(tx, a.tenantId, { students: accepted.length });

  const users = accepted.map((r) => ({
    id: randomUUID(), tenantId: a.tenantId, role: "STUDENT" as const, status: "ACTIVE" as const, email: r.email,
    studentId: r.student_id, fullName: r.full_name, department: r.department, phone: r.phone,
    studentType: r.student_type, passwordHash: unusablePasswordHash(),
  }));
  try {
    await tx.user.createMany({ data: users });
  } catch {
    throw new AppError("IMPORT_CONFLICT", "Another change created one of these accounts while importing. Please retry.", 409);
  }

  // Invite each student: hashed single-use token (stored) + email carrying the raw token (via outbox).
  const tokens = users.map((u) => ({ u, raw: newToken() }));
  await tx.passwordToken.createMany({
    data: tokens.map(({ u, raw }) => ({ userId: u.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + INVITE_TTL_MS) })),
  });
  await enqueueEmails(
    tx,
    tokens.map(({ u, raw }) => ({
      tenantId: a.tenantId, to: u.email, kind: "INVITE" as const, dedupeKey: `invite:${u.id}:${sha256(raw).slice(0, 12)}`,
      ...invite({ name: u.fullName, school: a.tenantName, token: raw }),
    })),
  );

  await audit(tx, { tenantId: a.tenantId, userId: a.actorId, ip: a.ip, action: "STUDENTS_IMPORTED", details: { created: users.length, rejectedRows: errors.length } });
  return result(users.length);
}
