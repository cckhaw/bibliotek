import { z } from "zod";

// On Vercel the production hostname is provided automatically (no protocol); use it when APP_URL is not set so emailed
// links (invitations, setup links) never point at localhost on a deployed site.
const defaultAppUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

const schema = z.object({
  DATABASE_URL: z.string().min(1), // runtime role, RLS enforced
  SYSTEM_DATABASE_URL: z.string().min(1).optional(), // owner role: login, super-admin, cron fan-out
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(8),
  APP_URL: z.string().url().default(defaultAppUrl).transform((u) => u.replace(/\/+$/, "")), // no trailing slash: links are built as `${APP_URL}/path`
  RESEND_API_KEY: z.string().optional(), // preferred: send through Resend (https://resend.com)
  SMTP_URL: z.string().optional(), // fallback: e.g. smtps://user:pass@smtp.example.com; neither set = log emails to console
  MAIL_FROM: z.string().default("Bibliotek <noreply@khaw.cc>"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Parsed lazily so `next build` does not need runtime secrets. */
export function env(): Env {
  return (cached ??= schema.parse(process.env));
}
