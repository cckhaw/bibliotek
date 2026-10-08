import nodemailer, { type Transporter } from "nodemailer";
import type { Tx } from "../db";
import { sysDb } from "../db";
import { env } from "../env";
import { sendViaResend } from "./resend";

export interface OutgoingEmail {
  tenantId: string | null;
  to: string;
  subject: string;
  body: string;
  kind: "DUE_SOON" | "OVERDUE" | "SHIFT_PUBLISHED" | "SHIFT_MODIFIED" | "INVITE" | "PASSWORD_RESET";
  /** Idempotency key: re-running a job for the same event never produces a second email. */
  dedupeKey: string;
}

/** Insert inside the caller's transaction (transactional outbox): no email without the business change, and vice versa. */
export async function enqueueEmails(tx: Tx, emails: OutgoingEmail[]): Promise<number> {
  if (emails.length === 0) return 0;
  const r = await tx.emailOutbox.createMany({
    data: emails.map((e) => ({ tenantId: e.tenantId, toEmail: e.to, subject: e.subject, body: e.body, kind: e.kind, dedupeKey: e.dedupeKey })),
    skipDuplicates: true,
  });
  return r.count;
}

const MAX_ATTEMPTS = 5;
const SENSITIVE_KINDS = new Set(["INVITE", "PASSWORD_RESET"]);

let transport: Transporter | undefined;
function getTransport() {
  const url = env().SMTP_URL;
  return (transport ??= url ? nodemailer.createTransport(url) : nodemailer.createTransport({ jsonTransport: true }));
}

/** Provider order: Resend (RESEND_API_KEY) -> SMTP (SMTP_URL) -> console log (development / CI). */
async function deliver(m: { id: string; toEmail: string; subject: string; body: string }) {
  const { RESEND_API_KEY, SMTP_URL, MAIL_FROM } = env();
  if (RESEND_API_KEY) {
    await sendViaResend({ apiKey: RESEND_API_KEY, from: MAIL_FROM, to: m.toEmail, subject: m.subject, text: m.body, idempotencyKey: `bibliotek-${m.id}` });
    return;
  }
  await getTransport().sendMail({ from: MAIL_FROM, to: m.toEmail, subject: m.subject, text: m.body });
  if (!SMTP_URL) console.log(`[mail:dev] to=${m.toEmail} subject="${m.subject}"\n${m.body}\n`);
}

interface Claimed {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  kind: string;
  attempts: number;
}

/** Worker: claims rows with SKIP LOCKED so overlapping cron invocations never double-send. */
export async function flushOutbox(limit = 100): Promise<{ sent: number; failed: number }> {
  const db = sysDb();
  const rows = await db.$queryRaw<Claimed[]>`
    UPDATE email_outbox SET attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM email_outbox
      WHERE status = 'PENDING' AND "scheduledAt" <= now() AND attempts < ${MAX_ATTEMPTS}
      ORDER BY "scheduledAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING id, "toEmail", subject, body, kind, attempts`;

  let sent = 0;
  let failed = 0;
  for (const m of rows) {
    try {
      await deliver(m);
      await db.emailOutbox.update({
        where: { id: m.id },
        // Invite/reset bodies contain a live token: scrub once delivered.
        data: { status: "SENT", sentAt: new Date(), lastError: null, ...(SENSITIVE_KINDS.has(m.kind) ? { body: "[redacted after delivery]" } : {}) },
      });
      sent++;
    } catch (e) {
      failed++;
      const exhausted = m.attempts >= MAX_ATTEMPTS;
      await db.emailOutbox.update({
        where: { id: m.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          lastError: String(e).slice(0, 500),
          scheduledAt: new Date(Date.now() + 2 ** m.attempts * 60_000), // exponential backoff
        },
      });
    }
  }
  return { sent, failed };
}
