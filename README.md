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
