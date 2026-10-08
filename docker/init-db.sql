-- Run once as a Postgres superuser (docker-entrypoint runs this automatically on first start).
-- `bibliotek` owns the schema (migrations, system tasks). `bibliotek_app` is the RLS-enforced runtime role.
CREATE ROLE bibliotek_app LOGIN PASSWORD 'bibliotek_app';
GRANT CONNECT ON DATABASE bibliotek TO bibliotek_app;
