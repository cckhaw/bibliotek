# Bibliotek

Multi-tenant, multi-branch library management for schools and universities.

Each school is an isolated tenant with its own users, catalogue, borrowing rules and license. A school can run several
libraries (branches), and a book borrowed at one branch can be returned at any other.

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL with Row-Level Security · Prisma 6 · Tailwind CSS 4 · Resend (email)

Design decisions and the schema review are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Home-page photography credits: [docs/PHOTO_CREDITS.md](docs/PHOTO_CREDITS.md).

---

## What it does

| Area | Highlights |
|---|---|
| **Catalogue** | Genre, subject, ISBN, Dewey and Library of Congress codes, custom tags. Search by title, author, ISBN, subject, Dewey/LC code or tag. Public read-only catalogue per school at `/t/<school-code>`. |
| **Bulk CSV import** | Books and students. Validate-first mode, ISBN-10/13 check digits, and a report that names the exact line and column of every bad row. Valid rows import; rejected rows come back for fixing. |
| **Students** | Self-registration with verified-email-domain rules or a librarian approval queue; bulk import with automatic invitation emails. |
| **Circulation** | Scanner-first checkout and return desk, per-student-type loan periods and limits, extension requests with librarian approval. |
| **Cross-branch returns** | Only the book's *current* location changes. Its home branch (original cataloguing) is untouched, and the return is audited. |
| **Fines** | Configurable free days, grace period, daily rate and cap. Daily accrual that can be safely re-run. Librarians can mark paid or waive with a reason. Borrowing is blocked automatically when unpaid fines reach the limit. |
| **Reminders** | Automatic "due soon" and "overdue" emails, de-duplicated so a re-run never double-sends. |
| **Roster** | Librarian duty shifts by branch, date and time. Draft, then publish. Librarians get one email per publish and another when a published shift changes. Double-booking is blocked by the database. |
| **Licensing** | Caps on students, on book copies, or both. Enforced when students register or import and when books import. Operators change tier and limits per tenant. |
| **Platform admin** | Provision tenants, change plans and limits, suspend access, view usage, active users and storage, edit a school admin's name and email, send setup links. |
| **Accounts** | Email + password, show/hide password toggle, **forgot password with an emailed 6-digit code**, invite links for imported students and new staff. |

### Roles and portals

| Role | Area | Can do |
|---|---|---|
| Student | `/student` | Browse the catalogue, see loans, due dates, fines and history, request extensions |
| Librarian | `/librarian` | Checkout/return desk, requests queue, fines, own shifts |
| School admin | `/admin` (+ librarian tools) | Imports, borrowing policies, branches, staff, roster, registration rules, usage and license overview |
| Super admin | `/super-admin` | Tenants, plans and limits, school admins, own profile |

The layout is responsive for desktop, tablet and phone.

---

## Quick start (local development)

Requires Node 20+ and Docker (or any PostgreSQL 14+).

```bash
docker compose up -d          # PostgreSQL 16 with the two roles described below
cp .env.example .env          # then set AUTH_SECRET and CRON_SECRET
npm install
npm run db:deploy             # applies the migrations as the owner role
npm run db:seed               # demo school "demo-uni" and demo users
npm run dev                   # http://localhost:3000
```

The seed creates (password `ChangeMe-123456`, **demo only**): `superadmin@bibliotek.test`, `admin@demo.edu`,
`librarian@demo.edu`, `student@students.demo.edu`. Barcodes `CLEAN-001`, `HIST-001` and `DUNE-001` exist, and the
student ID is `S1001`. The seed refuses to run when `NODE_ENV=production`.

> Without Docker, create the roles yourself, as in [docker/init-db.sql](docker/init-db.sql).

### Two database roles (important)

Tenant isolation is enforced by PostgreSQL itself, so the app connects as **two different roles**:

| Role | Used for | Setting |
|---|---|---|
| `bibliotek_app` (plain login role, **not** the owner) | Every tenant request. Row-Level Security applies, and with no tenant set it sees zero rows. | `DATABASE_URL` |
| `bibliotek` (database owner) | Migrations, seed, login, tenant lookup, super-admin screens, scheduled jobs. Bypasses RLS. | `DATABASE_URL_OWNER`, `SYSTEM_DATABASE_URL` |

Never point `DATABASE_URL` at the owner, a superuser, or any role with `BYPASSRLS`: tenant isolation would stop working at the database level.
The app **checks this itself** on the first tenant request and, if the role is exempt from Row-Level Security, refuses to serve tenant data and logs
`[security] Tenant isolation is not enforced: …` rather than leaking. On top of RLS, every tenant query is also forced to the current tenant in application
code (`src/lib/tenant-scope.ts`), so isolation does not depend on a single layer.

**Verify your database** (run as the owner role; `bibliotek_app` must show `f | f`, and the table owner must be `bibliotek`, not `bibliotek_app`):
```sql
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('bibliotek', 'bibliotek_app');
SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';
```
**Repair** (as an admin/superuser) if the runtime role is exempt or lacks access, then redeploy:
```sql
ALTER ROLE bibliotek_app NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO bibliotek_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bibliotek_app;
GRANT EXECUTE ON FUNCTION app_current_tenant() TO bibliotek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bibliotek_app;
```
> Some hosts (for example Neon) give roles created in their dashboard `BYPASSRLS`, and the default role they provide owns the tables.
> Create `bibliotek_app` with SQL (`CREATE ROLE ... LOGIN PASSWORD ...`) and use *its* credentials in `DATABASE_URL`.

---

## Deploying to Vercel

You do not need to run `npm` yourself. Everything can be done from the Vercel and database dashboards.

1. **Database.** Use a hosted PostgreSQL (Neon, Supabase, RDS…). In its SQL editor, as a superuser/admin:
   ```sql
   CREATE ROLE bibliotek LOGIN PASSWORD '<owner password>';
   CREATE ROLE bibliotek_app LOGIN PASSWORD '<app password>';
   CREATE DATABASE bibliotek OWNER bibliotek;
   GRANT CONNECT ON DATABASE bibliotek TO bibliotek_app;
   ```
   Some hosts create the database and an owner for you. In that case only create `bibliotek_app`.
2. **Tables.** Connected to the `bibliotek` database as the owner role, run these files in order (copy them from `prisma/migrations/`):
   1. `20261008000000_init/migration.sql`
   2. `20261008000100_tenant_rls_and_constraints/migration.sql`
   3. `20261009000000_password_reset_otp/migration.sql`

   Run any future migration folders the same way, in name order. (Alternatively, `npm run db:deploy` does it from a machine with Node.)
3. **Vercel project.** Import the GitHub repo. Under **Settings → Build & Development**, make sure **Framework Preset = Next.js**.
   If the project was created while the repo was empty it defaults to "Other" and every page returns 404. Set the production branch (normally `main`).
4. **Environment variables** (Settings → Environment Variables), then **redeploy**. Variables apply only to new deployments.

   | Variable | Required | Purpose |
   |---|---|---|
   | `DATABASE_URL` | yes | Runtime connection as `bibliotek_app` (add `?sslmode=require` if your host needs it) |
   | `SYSTEM_DATABASE_URL` | yes | Same database as the owner role `bibliotek` |
   | `AUTH_SECRET` | yes | 32+ random characters (`openssl rand -base64 48`). Signs sessions and hashes one-time codes |
   | `CRON_SECRET` | yes | 8+ random characters. Vercel Cron sends it as a bearer token to `/api/jobs/*` |
   | `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | yes (first login) | Your platform operator login (password 12+ chars). Optional `SUPERADMIN_NAME` |
   | `APP_URL` | recommended | Public URL, e.g. `https://yourdomain.com`, used in emailed links. On Vercel it falls back to the production hostname if unset; set it explicitly for a custom domain |
   | `RESEND_API_KEY` | for email | Resend API key |
   | `MAIL_FROM` | for email | Sender on a domain verified in Resend. Default: `Bibliotek <noreply@khaw.cc>` |
   | `SMTP_URL` | optional | Fallback if `RESEND_API_KEY` is not set |
   | `DATABASE_URL_OWNER` | local only | Used by `npm run db:*` scripts |

5. **First login.** Sign in with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`. The account is created on server start, so rotating the password is just: change the variable and redeploy.
   Then **Provision** a school; its admin receives an invitation email.

> **Scheduled jobs on Vercel's free plan** run at most once a day (see `vercel.json`). Reminders and fine accrual are daily by design.
> Time-sensitive emails (one-time codes, invitations, setup links) are sent immediately and do not wait for a job.

---

## Troubleshooting: `/api/health` and error codes

Open `https://<your-site>/api/health`. It returns `ok` or, per check, a short **code** (never a hostname, username or password):

| Check | Code | Meaning / fix |
|---|---|---|
| `env` | `ENV_INVALID` | A variable is missing or malformed (`DATABASE_URL`, `AUTH_SECRET` 32+ chars, `CRON_SECRET`, `APP_URL`…). The server log names the variable. |
| `systemDb` / `appDb` | `DB_AUTH` | Wrong database username or password (URL-encode special characters, or use letters and digits only). |
| | `DB_UNREACHABLE` | Wrong host/port, database paused, or network blocked. The host is the database server, not your website. |
| | `DB_TLS` | Add `?sslmode=require` to the URL. |
| | `DB_MISSING` | The database name in the URL doesn't exist. |
| | `DB_BUSY` | Too many connections; use your host's pooled connection string. |
| `schema` | `DB_SCHEMA` | Migrations haven't been applied. |
| | `DB_PERMISSION` | The **system** login (`SYSTEM_DATABASE_URL`) can't read the tables, e.g. a role with `BYPASSRLS` that was never granted access. Use the table owner, or grant it access (see below). **Sign-in fails with this code.** |
| `appTables` | `DB_PERMISSION` | The **restricted** login (`DATABASE_URL`, `bibliotek_app`) lacks grants. Run the repair SQL under "Two database roles". |
| `systemRole` | `SYSTEM_RESTRICTED` | `SYSTEM_DATABASE_URL` is missing/blank or uses the restricted role. It must be the **owner** role, or nobody can sign in. |
| `rls` | `RLS_BYPASSRLS` | The `DATABASE_URL` role has the `BYPASSRLS` attribute (Neon gives this to roles created in its dashboard). The app refuses to serve tenant data. Fix: `ALTER ROLE <role> NOBYPASSRLS;`, or create the role with SQL. |
| | `RLS_OWNER` | The `DATABASE_URL` role owns the tables, or is a **member of the role that does**. Use a separate, non-owner role; check with `SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles u ON u.oid = m.member WHERE u.rolname = '<role>';` |
| | `RLS_SUPERUSER` | The `DATABASE_URL` role is a superuser. Use a plain role. |
| | `RLS_DISABLED` | RLS is not enabled on the tables: run the second migration. |

The same codes appear in sign-in errors ("The service is temporarily unavailable (DB_AUTH)…") and the details are in the Vercel runtime logs
(`[infra:…]`, `[security]`, `[config]`).

**If `schema` shows `DB_PERMISSION`** and you want to keep a non-owner role as `SYSTEM_DATABASE_URL`, grant it table access (as an admin), then redeploy.
It also needs `BYPASSRLS`, or it will report `SYSTEM_RESTRICTED`. Using the role that owns the tables avoids both:
```sql
GRANT USAGE ON SCHEMA public TO <system_role>;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO <system_role>;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <system_role>;
```

## Super admin account

`SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` define the platform operator. On every server start the app creates it, or updates the
password if it changed, and re-activates it if suspended. It never modifies an account that belongs to a school.

- That account's **email and password are managed by the environment**: change them there and redeploy. On **My profile** you can still change the display name.
- If you loaded demo data, delete `superadmin@bibliotek.test`, because its password is public.
- Changing `SUPERADMIN_EMAIL` creates a new operator and leaves the old one; delete the old one manually.

## Email

Email goes through **[Resend](https://resend.com)**: verify your sending domain, create an API key, and set `RESEND_API_KEY` and `MAIL_FROM`.

- Provider order: Resend → `SMTP_URL` → console log (development only). In production with none configured, sending **fails with a clear error** instead of pretending to succeed.
- Mail is queued in a database outbox in the same transaction as the change that causes it, with a de-duplication key and exponential-backoff retries.
- Screens that send mail (setup link, staff invite) report the real result, including Resend's reason on failure
  (for example "domain is not verified", or an API key that is invalid).
- Forgot-password codes: 6 digits, stored only as a keyed hash, valid 10 minutes, 5 attempts, single use, one request per minute. The response is identical whether or not the account exists. The environment-managed super admin is excluded (use `SUPERADMIN_PASSWORD`).

## Background jobs

`GET`/`POST /api/jobs/<name>` with `Authorization: Bearer $CRON_SECRET`, or locally `npm run job -- <name>`:

| Job | Does |
|---|---|
| `reminders` | Marks overdue loans; queues "due soon" and "overdue" emails |
| `fines` | Recomputes fines for every overdue loan (idempotent: safe to re-run) |
| `telemetry` | Daily per-tenant usage snapshot: students, copies, loans, active users, storage |
| `outbox` | Sends queued emails and retries failures |

All jobs are idempotent, and any scheduler (Vercel Cron, GitHub Actions, QStash) can call them.

---

## Testing

```bash
npm test             # unit tests: fine maths, ISBN/CSV parsing, Resend client, APP_URL resolution
npm run test:int     # integration tests on a real, migrated PostgreSQL (uses DATABASE_URL / SYSTEM_DATABASE_URL from .env)
npm run typecheck && npm run lint
```

The integration suite covers: tenant isolation (RLS), license limits, CSV imports, cross-branch returns, concurrent checkouts
(exactly one wins), fine accrual and waivers, reminder and outbox idempotency, roster overlap, the env-managed super admin,
password-reset codes (expiry, attempt limit, single use), operator profile rules, and email delivery success/failure paths.

## Project layout

```
prisma/schema.prisma        data model (changes from the original spec are marked [+] / [Δ])
prisma/migrations/          init, RLS + constraints, password-reset codes
prisma/seed.ts              local demo data
src/app/                    pages (route groups: (auth), (app) portals) and src/app/api (REST endpoints)
src/lib/services/           circulation, fines, licensing, CSV imports, roster, accounts, jobs, tenants
src/lib/auth/               session (JWT cookie), password hashing, RBAC permission map
src/lib/mail/               outbox worker, Resend client, templates
src/instrumentation.ts      creates the super admin from the environment on startup
tests/                      unit tests, and tests/integration for the database-backed suite
```

## Security notes

- **Tenant isolation, two independent layers:** (1) Postgres RLS on every tenant table through a non-owner role, with a transaction-scoped tenant context, failing closed with no tenant set; (2) every tenant query is forced to the current tenant in application code. A startup check refuses to serve tenant data if the runtime database role could bypass RLS.
- **Sessions** are httpOnly SameSite=Lax cookies; the user and tenant state is re-checked on every request, so suspensions and role changes apply immediately.
- **Passwords** are bcrypt-hashed. Login runs a hash comparison even for unknown emails and is throttled.
- **Cross-origin requests** to state-changing endpoints are rejected (Origin check plus SameSite).
- All permission checks go through one map (`src/lib/auth/rbac.ts`).

## Known limitations

- Login and reset throttling is per server instance; use Redis/Upstash for multi-instance rate limiting.
- Due dates and the roster are in UTC; per-tenant time zones are not implemented.
- Fines use the tenant's *current* policy rather than a snapshot taken at checkout.
- Plans only change the student/book limits; they do not switch features on or off, and there is no billing or invoicing.
- Bulk student-import invitations are sent by the scheduled `outbox` job, not immediately (to stay within Resend's rate limit).
- No email verification on self-registration beyond domain rules and the approval queue.
