-- Forgot-password one-time codes.
CREATE TABLE "password_reset_otps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_otps_userId_createdAt_idx" ON "password_reset_otps"("userId", "createdAt");

ALTER TABLE "password_reset_otps"
  ADD CONSTRAINT "password_reset_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- System-role only: RLS on with NO policy hides it from the tenant-scoped runtime role.
ALTER TABLE "password_reset_otps" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bibliotek_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "password_reset_otps" TO bibliotek_app;
  END IF;
END $$;
