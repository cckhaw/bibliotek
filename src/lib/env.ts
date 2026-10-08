import { z } from "zod";

// On Vercel the production hostname is provided automatically (no protocol); use it when APP_URL is not set so emailed
// links (invitations, setup links) never point at localhost on a deployed site.
const defaultAppUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

/** Dashboards often store a cleared variable as "" or add stray spaces; treat blank as "not set" and trim the rest. */
const clean = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v);

/** "bibliotek.khaw.cc" (no scheme) is a common mistake; assume https, except for localhost. */
const withScheme = (v: unknown) => {
  const c = clean(v);
  if (typeof c !== "string" || /^[a-z][a-z0-9+.-]*:\/\//i.test(c)) return c;
  return /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(c) ? `http://${c}` : `https://${c}`;
};

const schema = z.object({
  DATABASE_URL: z.string().min(1), // runtime role, RLS enforced
  SYSTEM_DATABASE_URL: z.preprocess(clean, z.string().min(1).optional()), // owner role: login, super-admin, cron fan-out
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(8),
  APP_URL: z.preprocess(withScheme, z.string().url().default(defaultAppUrl)).transform((u) => u.replace(/\/+$/, "")), // no trailing slash: links are built as `${APP_URL}/path`
  RESEND_API_KEY: z.preprocess(clean, z.string().optional()), // preferred: send through Resend (https://resend.com)
  SMTP_URL: z.preprocess(clean, z.string().optional()), // fallback: e.g. smtps://user:pass@smtp.example.com; neither set = log emails to console
  MAIL_FROM: z.preprocess(clean, z.string().default("Bibliotek <noreply@khaw.cc>")),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Parsed lazily so `next build` does not need runtime secrets. */
export function env(): Env {
  if (cached) return cached;
  const r = schema.safeParse(process.env);
  if (!r.success) {
    // Name the variables (never their values) so the runtime log says exactly what to fix.
    const problems = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${problems}`);
  }
  return (cached = r.data);
}
