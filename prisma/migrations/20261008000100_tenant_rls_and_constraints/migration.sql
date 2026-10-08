-- ---------------------------------------------------------------------------
-- Postgres-only objects that Prisma's schema language cannot express.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fast ILIKE catalog search
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed for the shift-overlap exclusion constraint

-- 1. Integrity constraints -----------------------------------------------------

-- A physical copy can have at most ONE open loan, regardless of application races.
CREATE UNIQUE INDEX loans_one_open_per_copy ON loans ("bookCopyId") WHERE "returnedAt" IS NULL;

-- A librarian cannot be rostered on two overlapping shifts (any branch).
ALTER TABLE duty_shifts
  ADD CONSTRAINT duty_shifts_no_overlap
  EXCLUDE USING gist ("librarianId" WITH =, tsrange("startTime", "endTime") WITH &&);

ALTER TABLE duty_shifts ADD CONSTRAINT duty_shifts_time_order CHECK ("endTime" > "startTime");
ALTER TABLE loans       ADD CONSTRAINT loans_due_after_borrow CHECK ("dueDate" >= "borrowedAt");
ALTER TABLE fines       ADD CONSTRAINT fines_non_negative     CHECK (amount >= 0);
ALTER TABLE tenants     ADD CONSTRAINT tenants_limits_positive CHECK ("maxStudents" >= 0 AND "maxBooks" >= 0);

-- 2. Search indexes ----------------------------------------------------------

CREATE INDEX catalog_items_title_trgm  ON catalog_items USING gin (title  gin_trgm_ops);
CREATE INDEX catalog_items_author_trgm ON catalog_items USING gin (author gin_trgm_ops);
CREATE INDEX catalog_items_tags_gin    ON catalog_items USING gin (tags);

-- 3. Row-Level Security --------------------------------------------------------
-- Tenant-scoped connections run as `bibliotek_app` (NOT the table owner, so RLS applies) and
-- every request opens a transaction that does:  SELECT set_config('app.tenant_id', $1, true)
-- Rows are then visible/writable only when "tenantId" matches. If the setting is absent or empty
-- no row matches -> fail closed.
-- The owner role (migrations, seed, cron fan-out, login, super-admin) bypasses RLS by ownership.

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '') $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches','users','catalog_items','book_copies','borrow_policies','loans','fines',
    'duty_shifts','audit_logs','extension_requests','email_outbox'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_current_tenant()) WITH CHECK ("tenantId" = app_current_tenant())', t);
  END LOOP;
END $$;

-- tenants is keyed by id rather than tenant_id
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = app_current_tenant()) WITH CHECK (id = app_current_tenant());

-- Platform-level table: RLS on with NO policy => invisible to the app role (system role only).
ALTER TABLE usage_snapshots ENABLE ROW LEVEL SECURITY;

-- password_tokens has no tenantId of its own; scope it through the owning user so invites can be
-- created atomically with the user inside a tenant transaction. (Token redemption is unauthenticated
-- and runs on the system role.)
ALTER TABLE password_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON password_tokens
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = "userId" AND u."tenantId" = app_current_tenant()))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = "userId" AND u."tenantId" = app_current_tenant()));

-- 4. Privileges for the runtime role (skipped if the role has not been created) -------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bibliotek_app') THEN
    GRANT USAGE ON SCHEMA public TO bibliotek_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bibliotek_app;
    GRANT EXECUTE ON FUNCTION app_current_tenant() TO bibliotek_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bibliotek_app;
  END IF;
END $$;
