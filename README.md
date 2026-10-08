# Bibliotek

Multi-tenant, multi-branch library management SaaS. Next.js 15 · TypeScript · PostgreSQL (RLS) · Prisma 6 · Tailwind 4.
Design decisions and schema review: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run locally
```bash
docker compose up -d                  # Postgres 16 + roles (bibliotek = owner, bibliotek_app = RLS-enforced runtime)
cp .env.example .env                  # then set AUTH_SECRET / CRON_SECRET
npm install
npm run db:deploy                     # migrations (as owner)
npm run db:seed                       # demo school "demo-uni" + users (password: ChangeMe-123456)
npm run dev
```
Demo logins: `superadmin@bibliotek.test`, `admin@demo.edu`, `librarian@demo.edu`, `student@students.demo.edu`. Public catalog: `/t/demo-uni`.

## Super admin account
Set `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` (12+ chars; optional `SUPERADMIN_NAME`) in your environment. On every server start
the app creates that platform operator or updates its password, so rotating it is: change the variable, redeploy.
It will never modify an account that belongs to a school. If you previously loaded the demo SQL/seed, delete the demo
`superadmin@bibliotek.test` user, because its password is public.

## Forgot password & email delivery
"Forgot password?" on the login page emails a 6-digit code (valid 10 minutes, 5 attempts, single use, one per minute).
**Email is sent through [Resend](https://resend.com)**: set `RESEND_API_KEY` and `MAIL_FROM` (an address on a domain you have verified in Resend; defaults to `Bibliotek <noreply@khaw.cc>`).
`SMTP_URL` is a fallback. With neither set the message is only written to the server log, so on a hosted deployment nobody receives the code. The environment-managed
super admin (`SUPERADMIN_EMAIL`) is reset through `SUPERADMIN_PASSWORD`, not by OTP.
After pulling this change run the new migration `prisma/migrations/20261009000000_password_reset_otp/migration.sql`.

## Tests
```bash
npm test            # unit: fine maths, ISBN, CSV parsing
npm run test:int    # integration on real Postgres: RLS isolation, licensing, imports, cross-branch returns,
                    # concurrency, fines/reminders/outbox idempotency, roster constraints
npm run typecheck && npm run lint
```

## Background jobs
`npm run job -- reminders|fines|telemetry|outbox`, or `GET /api/jobs/<name>` with `Authorization: Bearer $CRON_SECRET`
(Vercel Cron schedules in `vercel.json`). All jobs are idempotent.
