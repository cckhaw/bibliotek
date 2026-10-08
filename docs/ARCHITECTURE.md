# Bibliotek — architecture & schema evaluation

## 1. Architectural choices

| Concern | Choice | Why |
|---|---|---|
| App | **Next.js 15 (App Router) + TypeScript**, one deployable | Server components read data directly; route handlers form the REST API; one codebase for four portals. |
| UI | **Tailwind CSS v4**, mobile-first | Sidebar becomes a scrollable tab bar below `md`; tables scroll inside their card; inputs are 16px (no iOS zoom). Verified at 375px with no horizontal scroll. |
| DB / ORM | **PostgreSQL + Prisma 6** (pinned: the spec schema uses `url = env()` / `prisma-client-js`, which Prisma 7 changes) | Spec requirement. |
| Tenant isolation | **Shared schema + Postgres Row-Level Security**, enforced by DB role | See §3. |
| Auth | Email + password (bcrypt), **signed JWT in an httpOnly SameSite=Lax cookie**; user + tenant state is re-read on every request | Suspending a user/tenant or changing a role applies immediately, not at token expiry. Email is globally unique so login needs no tenant picker. |
| RBAC | One permission map (`src/lib/auth/rbac.ts`); pages and routes check *permissions*, never roles. Middleware only gates URL areas. | Single place to audit. |
| Business logic | Plain services taking a transaction (`src/lib/services`), called by both pages and API routes | Testable against a real DB; no logic in route handlers. |
| Background jobs | Idempotent functions exposed at `/api/jobs/:name` (Bearer `CRON_SECRET`) and `npm run job`. Vercel Cron config included; QStash/GitHub Actions/any cron work. | No Redis/worker to run. Re-running is always safe. |
| Email | **Transactional outbox** (`email_outbox`) with unique `dedupeKey`; worker claims rows with `SKIP LOCKED`, retries with backoff | No email without the business change; no duplicate reminders; invite tokens scrubbed after delivery. |
| CSV | Papaparse + zod per-row validation; **line-numbered error report**, dry-run mode, all-valid-rows-or-nothing in one transaction, 5 MB / 50k-row caps | |

## 2. Schema evaluation

The supplied schema is a sound base: correct tenant/branch hierarchy, the home-vs-current branch split for cross-branch returns is exactly right, money is `Decimal`, and cascades are sensible. Every model and field was kept. Gaps found against the functional spec, and what was changed (`[+]` additive, `[Δ]` modified; all marked in `prisma/schema.prisma`):

**Modified (1)**
- `[Δ]` `BookCopy.barcode @unique` → `@@unique([tenantId, barcode])`. Global uniqueness lets one school's barcode block another's pre-printed labels and leaks existence across tenants.

**Added — required by the spec, not expressible before**
- *Extension requests*: `ExtensionRequest`, `Loan.renewalCount`, `BorrowPolicy.maxRenewals/renewalDays`.
- *Max loans per **student type***: `User.studentType`, `BorrowPolicy.studentType`.
- *Automated account block*: `BorrowPolicy.fineBlockThreshold` (checked live at checkout), optional `maxFinePerLoan`.
- *Licensing "books, students, or both"*: `Tenant.licenseMode`.
- *Self-registration rules*: `Tenant.allowedEmailDomains`, `autoApproveStudents`; `User.department/phone` for import mapping.
- *Classification & tags*: `CatalogItem.genre/subject/lcCode/tags`, `@@unique([tenantId, isbn])` (ISBN upsert on import).
- *Draft → publish roster and change detection*: `DutyShift.publishedAt/updatedAt`.
- *Idempotent daily fines + waiver trail*: `Fine @@unique([loanId])`, `daysOverdue`, `waivedBy/At/Reason`.
- *Invites / password reset*: `PasswordToken` (sha256 hashed, single use).
- *Telemetry*: `UsageSnapshot`. *Email*: `EmailOutbox`. *Reminders*: `Tenant.reminderLeadDays`.
- Indexes on every hot path (loan sweeps, user/status, catalog title/category).

**Enforced in SQL (`migrations/*_tenant_rls_and_constraints`)**
- `UNIQUE (bookCopyId) WHERE returnedAt IS NULL`: a copy can never have two open loans, even under races.
- Exclusion constraint: a librarian cannot hold overlapping shifts.
- CHECKs (shift order, due ≥ borrowed, non-negative fines, non-negative limits); trigram + GIN indexes for search.
- RLS policies on every tenant table.

**Known limitations / deliberate non-changes**
- `Loan.status = OVERDUE` is a materialised flag refreshed by the reminders job; "overdue" is *authoritatively* `returnedAt IS NULL AND dueDate < now()` (UI and fines use that).
- Fines use the tenant's *current* policy rather than a snapshot taken at checkout, so changing a rate affects open loans. A snapshot on `Loan` is the fix if tenants need it.
- Cross-tenant foreign keys are not rejected by the DB (FK checks bypass RLS), but services only ever resolve ids through RLS-filtered reads, so a foreign id is "not found".
- `LoanStatus.LOST`, `CopyStatus.RESERVED/IN_TRANSIT` exist but have no workflow yet.
- Column names stay camelCase (the spec has no `@map` on fields), so raw SQL must quote them.

## 3. Multi-tenancy model

Two connections, two roles:
- `DATABASE_URL` → `bibliotek_app`, **not** the table owner, so RLS applies. Every tenant request runs `withTenant(id, tx => …)`, a transaction that executes `set_config('app.tenant_id', id, true)` (transaction-local → cannot leak across pooled connections). With no tenant set, queries return **zero rows** (fail closed); cross-tenant writes are rejected.
- `SYSTEM_DATABASE_URL` → owner role (bypasses RLS) used only for login, tenant-by-code lookup, super-admin screens and job fan-out. Jobs still do per-tenant work inside `withTenant`.

This protects against a forgotten `where tenantId` or an injection in tenant-scoped code; it does not protect against code that deliberately uses the system client, so that client is confined to a few modules.

## 4. Licensing

`assertCapacity()` is called inside the same transaction as the insert (student registration, CSV import of students/books) behind a per-tenant advisory lock, so concurrent requests cannot both pass under the cap. Super-admin can change tier, caps, and enforcement mode; lowering a cap never deletes data, it blocks additions.

## 5. Circulation rules (as implemented)

- **Checkout**: borrower must be ACTIVE; unpaid fines ≥ policy threshold blocks; per-user advisory lock + max-loans check; copy claimed with an atomic conditional update; due date = end of day (UTC) + free days.
- **Return** at any branch of the tenant: sets `currentBranchId` only; `homeBranchId` untouched; `BRANCH_RETURN` audited; fine computed.
- **Fine** = `max(0, ceil(daysLate) − grace) × daily rate`, integer cents, optional cap; recomputed from dates by the daily job (never incremented), so re-runs are no-ops; PAID/WAIVED fines are frozen.

## 6. Added since the first version
- Email via Resend with a transactional outbox; screens report real delivery results.
- Forgot-password with an emailed one-time code (`password_reset_otps`, keyed hash, 10 min, 5 attempts, single use).
- Environment-managed super admin (`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`), applied at server start.
- Super admin can edit a school admin's name/email, send setup links, and edit their own profile.

## 7. Still to do before heavy production use
Redis-backed rate limiting (current throttle is per-instance); per-tenant timezone for due dates and roster display;
pagination on admin lists; connection-pool sizing (PgBouncer in transaction mode works with `set_config(..., true)`);
feature gating and billing per plan; email verification for self-registration.
