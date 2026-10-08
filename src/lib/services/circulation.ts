import type { Tx } from "../db";
import { advisoryLock } from "../db";
import { AppError, conflict, forbidden, notFound } from "../errors";
import { audit } from "../audit";
import { dueDateFrom, resolvePolicy } from "./policy";
import { syncFine, toCents, unpaidTotalCents } from "./fines";

interface Actor {
  tenantId: string;
  actorId: string;
  ip?: string | null;
}

const LENDABLE_STATUSES = ["AVAILABLE", "IN_TRANSIT"] as const;

async function findCopy(tx: Tx, barcode: string) {
  const copy = await tx.bookCopy.findFirst({
    where: { barcode: barcode.trim() },
    include: { catalogItem: { select: { title: true, author: true } } },
  });
  if (!copy) throw notFound(`Copy with barcode "${barcode}"`);
  return copy;
}

/** Borrower may be identified by school student ID, email, or internal id (scanner / typed / QR). */
async function findBorrower(tx: Tx, borrower: string) {
  const q = borrower.trim();
  const user = await tx.user.findFirst({
    where: { role: "STUDENT", OR: [{ studentId: q }, { email: q.toLowerCase() }, { id: q }] },
  });
  if (!user) throw notFound(`Student "${q}"`);
  return user;
}

export async function checkout(tx: Tx, a: Actor & { branchId: string; barcode: string; borrower: string }) {
  const branch = await tx.branch.findUnique({ where: { id: a.branchId } });
  if (!branch) throw notFound("Branch");

  const copy = await findCopy(tx, a.barcode);
  if (copy.condition === "LOST" || copy.condition === "DAMAGED") {
    throw conflict("COPY_NOT_LENDABLE", `This copy is marked ${copy.condition.toLowerCase()} and cannot be lent`);
  }

  const user = await findBorrower(tx, a.borrower);
  if (user.status !== "ACTIVE") throw forbidden(`Borrower account is ${user.status.toLowerCase().replace("_", " ")}`);

  // Serialise per borrower so two simultaneous checkouts cannot both pass the loan-limit check.
  await advisoryLock(tx, `loan:${user.id}`);
  const policy = await resolvePolicy(tx, user.studentType);

  const unpaid = await unpaidTotalCents(tx, user.id);
  if (unpaid >= toCents(policy.fineBlockThreshold) && toCents(policy.fineBlockThreshold) > 0) {
    throw new AppError(
      "FINES_BLOCK",
      `Account blocked: unpaid fines of ${(unpaid / 100).toFixed(2)} reach the limit of ${(toCents(policy.fineBlockThreshold) / 100).toFixed(2)}`,
      403,
      { unpaid: unpaid / 100 },
    );
  }

  const open = await tx.loan.count({ where: { userId: user.id, returnedAt: null } });
  if (open >= policy.maxLoansPerUser) {
    throw conflict("LOAN_LIMIT", `Loan limit reached (${open}/${policy.maxLoansPerUser})`);
  }

  // Atomic claim: only one concurrent checkout can flip AVAILABLE -> CHECKED_OUT.
  const claimed = await tx.bookCopy.updateMany({
    where: { id: copy.id, status: { in: [...LENDABLE_STATUSES] } },
    data: { status: "CHECKED_OUT", currentBranchId: branch.id },
  });
  if (claimed.count === 0) throw conflict("COPY_UNAVAILABLE", `Copy is not available (status: ${copy.status})`);

  const now = new Date();
  const loan = await tx.loan.create({
    data: {
      tenantId: a.tenantId,
      bookCopyId: copy.id,
      userId: user.id,
      checkoutBranchId: branch.id,
      borrowedAt: now,
      dueDate: dueDateFrom(now, policy.freeRentalDays),
    },
  });

  // The physical scan is the source of truth: if the system thought it was elsewhere, record the correction.
  if (copy.currentBranchId !== branch.id) {
    await audit(tx, { ...a, userId: a.actorId, action: "LOCATION_CORRECTED", details: { copyId: copy.id, was: copy.currentBranchId, now: branch.id } });
  }
  await audit(tx, { ...a, userId: a.actorId, action: "CHECKOUT", details: { loanId: loan.id, copyId: copy.id, borrowerId: user.id } });

  return { loan, title: copy.catalogItem.title, borrower: { id: user.id, fullName: user.fullName }, policy: policy.name };
}

export async function returnBook(tx: Tx, a: Actor & { branchId: string; barcode: string }) {
  const branch = await tx.branch.findUnique({ where: { id: a.branchId } });
  if (!branch) throw notFound("Branch");
  const copy = await findCopy(tx, a.barcode);

  const loan = await tx.loan.findFirst({ where: { bookCopyId: copy.id, returnedAt: null }, include: { user: true } });
  if (!loan) throw conflict("NOT_ON_LOAN", "This copy is not currently on loan");

  const now = new Date();
  await tx.loan.update({ where: { id: loan.id }, data: { returnedAt: now, returnedBranchId: branch.id, status: "RETURNED" } });
  // Cross-branch return: only the CURRENT location moves. homeBranchId (original cataloguing) is untouched.
  await tx.bookCopy.update({ where: { id: copy.id }, data: { status: "AVAILABLE", currentBranchId: branch.id } });

  const policy = await resolvePolicy(tx, loan.user.studentType);
  const fine = await syncFine(tx, loan, policy, now);

  const crossBranch = branch.id !== copy.homeBranchId;
  if (crossBranch) {
    await audit(tx, {
      ...a, userId: a.actorId, action: "BRANCH_RETURN",
      details: { copyId: copy.id, homeBranchId: copy.homeBranchId, checkoutBranchId: loan.checkoutBranchId, returnedBranchId: branch.id },
    });
  }
  await audit(tx, { ...a, userId: a.actorId, action: "RETURN", details: { loanId: loan.id, copyId: copy.id, fine: fine?.amount.toString() ?? null } });

  return {
    title: copy.catalogItem.title,
    borrower: { id: loan.user.id, fullName: loan.user.fullName },
    returnedAt: now,
    crossBranch,
    homeBranchId: copy.homeBranchId,
    fine: fine ? { amount: fine.amount.toString(), daysOverdue: fine.daysOverdue } : null,
  };
}

export async function requestExtension(tx: Tx, a: { tenantId: string; userId: string; loanId: string; reason?: string }) {
  const loan = await tx.loan.findFirst({ where: { id: a.loanId, userId: a.userId, returnedAt: null }, include: { user: true } });
  if (!loan) throw notFound("Active loan");
  const policy = await resolvePolicy(tx, loan.user.studentType);

  if (loan.dueDate < new Date()) throw conflict("LOAN_OVERDUE", "Overdue loans cannot be extended; please return the book");
  if (loan.renewalCount >= policy.maxRenewals) throw conflict("RENEWAL_LIMIT", `This loan has already been extended ${loan.renewalCount} time(s)`);

  const pending = await tx.extensionRequest.count({ where: { loanId: loan.id, status: "PENDING" } });
  if (pending > 0) throw conflict("ALREADY_REQUESTED", "An extension request is already pending for this loan");

  return tx.extensionRequest.create({ data: { tenantId: a.tenantId, loanId: loan.id, userId: a.userId, reason: a.reason } });
}

export async function decideExtension(tx: Tx, a: Actor & { requestId: string; approve: boolean }) {
  const req = await tx.extensionRequest.findFirst({ where: { id: a.requestId, status: "PENDING" }, include: { loan: { include: { user: true } } } });
  if (!req) throw notFound("Pending extension request");

  if (a.approve) {
    const { loan } = req;
    if (loan.returnedAt) throw conflict("LOAN_CLOSED", "This loan was already returned");
    const policy = await resolvePolicy(tx, loan.user.studentType);
    if (loan.renewalCount >= policy.maxRenewals) throw conflict("RENEWAL_LIMIT", "Renewal limit reached");
    await tx.loan.update({
      where: { id: loan.id },
      data: { dueDate: dueDateFrom(loan.dueDate, policy.renewalDays), renewalCount: { increment: 1 }, status: "ACTIVE" },
    });
  }
  const updated = await tx.extensionRequest.update({
    where: { id: req.id },
    data: { status: a.approve ? "APPROVED" : "REJECTED", decidedBy: a.actorId, decidedAt: new Date() },
  });
  await audit(tx, { ...a, userId: a.actorId, action: a.approve ? "EXTENSION_APPROVED" : "EXTENSION_REJECTED", details: { requestId: req.id, loanId: req.loanId } });
  return updated;
}

export async function waiveFine(tx: Tx, a: Actor & { fineId: string; reason: string }) {
  const fine = await tx.fine.findFirst({ where: { id: a.fineId } });
  if (!fine) throw notFound("Fine");
  if (fine.status !== "UNPAID") throw conflict("FINE_CLOSED", `Fine is already ${fine.status.toLowerCase()}`);
  const updated = await tx.fine.update({ where: { id: fine.id }, data: { status: "WAIVED", waivedBy: a.actorId, waivedAt: new Date(), waiveReason: a.reason } });
  await audit(tx, { ...a, userId: a.actorId, action: "FINE_WAIVED", details: { fineId: fine.id, amount: fine.amount.toString(), reason: a.reason } });
  return updated;
}

export async function markFinePaid(tx: Tx, a: Actor & { fineId: string }) {
  const fine = await tx.fine.findFirst({ where: { id: a.fineId } });
  if (!fine) throw notFound("Fine");
  if (fine.status !== "UNPAID") throw conflict("FINE_CLOSED", `Fine is already ${fine.status.toLowerCase()}`);
  const updated = await tx.fine.update({ where: { id: fine.id }, data: { status: "PAID", paidAt: new Date() } });
  await audit(tx, { ...a, userId: a.actorId, action: "FINE_PAID", details: { fineId: fine.id, amount: fine.amount.toString() } });
  return updated;
}
