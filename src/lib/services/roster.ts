import { z } from "zod";
import type { Tx } from "../db";
import { AppError, notFound } from "../errors";
import { audit } from "../audit";
import { enqueueEmails } from "../mail/outbox";
import { shiftChanged, shiftsPublished } from "../mail/templates";

export const shiftSchema = z
  .object({
    branchId: z.string().min(1),
    librarianId: z.string().min(1),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    notes: z.string().max(500).optional(),
  })
  .refine((s) => s.endTime > s.startTime, { message: "End must be after start", path: ["endTime"] })
  .refine((s) => s.endTime.getTime() - s.startTime.getTime() <= 16 * 3600_000, { message: "A shift cannot exceed 16 hours", path: ["endTime"] });

type ShiftInput = z.infer<typeof shiftSchema>;

/** DB exclusion constraint `duty_shifts_no_overlap` is the real guard; translate its error into a friendly one. */
function mapOverlap(e: unknown): never {
  const msg = String((e as { message?: string })?.message ?? e);
  if (msg.includes("duty_shifts_no_overlap") || msg.includes("23P01")) {
    throw new AppError("SHIFT_OVERLAP", "This librarian already has a shift overlapping that time", 409);
  }
  throw e;
}

async function assertRefs(tx: Tx, s: ShiftInput) {
  const [branch, lib] = await Promise.all([
    tx.branch.findUnique({ where: { id: s.branchId } }),
    tx.user.findFirst({ where: { id: s.librarianId, role: { in: ["LIBRARIAN", "TENANT_ADMIN"] }, status: "ACTIVE" } }),
  ]);
  if (!branch) throw notFound("Branch");
  if (!lib) throw notFound("Active librarian");
  return { branch, lib };
}

/** New shifts start as drafts; librarians are only notified when the roster is published. */
export async function createShift(tx: Tx, a: { tenantId: string; actorId: string; input: ShiftInput }) {
  await assertRefs(tx, a.input);
  try {
    const shift = await tx.dutyShift.create({ data: { tenantId: a.tenantId, ...a.input } });
    await audit(tx, { tenantId: a.tenantId, userId: a.actorId, action: "SHIFT_CREATED", details: { shiftId: shift.id } });
    return shift;
  } catch (e) { mapOverlap(e); }
}

export async function updateShift(tx: Tx, a: { tenantId: string; actorId: string; shiftId: string; input: ShiftInput }) {
  const prev = await tx.dutyShift.findUnique({ where: { id: a.shiftId } });
  if (!prev) throw notFound("Shift");
  const { branch, lib } = await assertRefs(tx, a.input);
  try {
    const shift = await tx.dutyShift.update({ where: { id: prev.id }, data: a.input });
    if (prev.publishedAt) {
      // Already published -> tell the librarian (and the previous librarian if the shift was reassigned).
      const mails = [{ tenantId: a.tenantId, to: lib.email, kind: "SHIFT_MODIFIED" as const, dedupeKey: `shift-mod:${shift.id}:${shift.updatedAt.getTime()}`, ...shiftChanged({ name: lib.fullName, branch: branch.name, start: shift.startTime, end: shift.endTime }) }];
      if (prev.librarianId !== shift.librarianId) {
        const old = await tx.user.findUnique({ where: { id: prev.librarianId } });
        const oldBranch = await tx.branch.findUnique({ where: { id: prev.branchId } });
        if (old) mails.push({ tenantId: a.tenantId, to: old.email, kind: "SHIFT_MODIFIED", dedupeKey: `shift-cancel:${shift.id}:${shift.updatedAt.getTime()}`, ...shiftChanged({ name: old.fullName, branch: oldBranch?.name ?? "", start: prev.startTime, end: prev.endTime, cancelled: true }) });
      }
      await enqueueEmails(tx, mails);
      await tx.dutyShift.update({ where: { id: shift.id }, data: { notifiedAt: new Date() } });
    }
    await audit(tx, { tenantId: a.tenantId, userId: a.actorId, action: "SHIFT_UPDATED", details: { shiftId: shift.id, wasPublished: !!prev.publishedAt } });
    return shift;
  } catch (e) { mapOverlap(e); }
}

export async function deleteShift(tx: Tx, a: { tenantId: string; actorId: string; shiftId: string }) {
  const prev = await tx.dutyShift.findUnique({ where: { id: a.shiftId }, include: { librarian: true, branch: true } });
  if (!prev) throw notFound("Shift");
  await tx.dutyShift.delete({ where: { id: prev.id } });
  if (prev.publishedAt) {
    await enqueueEmails(tx, [{ tenantId: a.tenantId, to: prev.librarian.email, kind: "SHIFT_MODIFIED", dedupeKey: `shift-del:${prev.id}`, ...shiftChanged({ name: prev.librarian.fullName, branch: prev.branch.name, start: prev.startTime, end: prev.endTime, cancelled: true }) }]);
  }
  await audit(tx, { tenantId: a.tenantId, userId: a.actorId, action: "SHIFT_DELETED", details: { shiftId: prev.id } });
}

/** Publish all draft shifts in a window; each affected librarian gets ONE digest email. */
export async function publishRoster(tx: Tx, a: { tenantId: string; actorId: string; from: Date; to: Date; branchId?: string }) {
  const drafts = await tx.dutyShift.findMany({
    where: { publishedAt: null, startTime: { gte: a.from, lt: a.to }, ...(a.branchId ? { branchId: a.branchId } : {}) },
    include: { librarian: true, branch: true },
    orderBy: { startTime: "asc" },
  });
  if (drafts.length === 0) return { published: 0, notified: 0 };

  const now = new Date();
  await tx.dutyShift.updateMany({ where: { id: { in: drafts.map((d) => d.id) } }, data: { publishedAt: now, notifiedAt: now } });

  const byLib = new Map<string, typeof drafts>();
  for (const d of drafts) byLib.set(d.librarianId, [...(byLib.get(d.librarianId) ?? []), d]);
  const mails = [...byLib.values()].map((list) => ({
    tenantId: a.tenantId, to: list[0].librarian.email, kind: "SHIFT_PUBLISHED" as const,
    dedupeKey: `shift-pub:${list[0].librarianId}:${now.getTime()}`,
    ...shiftsPublished({ name: list[0].librarian.fullName, shifts: list.map((s) => ({ start: s.startTime, end: s.endTime, branch: s.branch.name })) }),
  }));
  await enqueueEmails(tx, mails);
  await audit(tx, { tenantId: a.tenantId, userId: a.actorId, action: "ROSTER_PUBLISHED", details: { shifts: drafts.length, librarians: mails.length } });
  return { published: drafts.length, notified: mails.length };
}
