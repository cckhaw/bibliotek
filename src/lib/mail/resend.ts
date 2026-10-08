export interface ResendMessage {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  /** Resend de-duplicates requests with the same key for 24h, so a retry after a timeout cannot double-send. */
  idempotencyKey?: string;
}

/** Thin client for https://resend.com/docs/api-reference/emails/send-email (no SDK needed). Throws on any non-2xx. */
export async function sendViaResend(m: ResendMessage, fetchImpl: typeof fetch = fetch): Promise<{ id?: string }> {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${m.apiKey}`,
      "Content-Type": "application/json",
      ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: m.from, to: [m.to], subject: m.subject, text: m.text }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}${body.name ? ` ${body.name}` : ""}: ${body.message ?? "request failed"}`);
  return { id: body.id };
}
