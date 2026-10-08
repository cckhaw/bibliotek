import { Prisma } from "@prisma/client";

/**
 * Turns low-level infrastructure failures into a short, SAFE code (no hostnames, usernames or passwords) that an
 * operator can look up. Returns null for ordinary application errors.
 *
 *  ENV_INVALID     a required environment variable is missing/malformed
 *  DB_AUTH         the database rejected the username/password
 *  DB_UNREACHABLE  cannot reach the database host (wrong host/port, paused, network)
 *  DB_TLS          SSL/TLS negotiation failed (usually a missing ?sslmode=require)
 *  DB_MISSING      the named database does not exist
 *  DB_SCHEMA       tables/columns are missing (migrations not applied)
 *  DB_PERMISSION   the role lacks privileges on the tables (grants missing)
 *  DB_BUSY         connection limit / pool timeout
 *  DB_ERROR        some other database failure
 */
export type InfraCode = "ENV_INVALID" | "DB_AUTH" | "DB_UNREACHABLE" | "DB_TLS" | "DB_MISSING" | "DB_SCHEMA" | "DB_PERMISSION" | "DB_BUSY" | "DB_ERROR";

const BY_PRISMA_CODE: Record<string, InfraCode> = {
  P1000: "DB_AUTH", P1010: "DB_AUTH", P1001: "DB_UNREACHABLE", P1002: "DB_UNREACHABLE", P1008: "DB_UNREACHABLE", P1017: "DB_UNREACHABLE",
  P1003: "DB_MISSING", P1011: "DB_TLS", P2021: "DB_SCHEMA", P2022: "DB_SCHEMA", P2024: "DB_BUSY",
};

export function classifyInfraError(e: unknown): InfraCode | null {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (msg.startsWith("Invalid environment configuration")) return "ENV_INVALID";

  const prismaCode = (e as { errorCode?: string; code?: string } | null)?.errorCode ?? (e as { code?: string } | null)?.code;
  if (prismaCode && BY_PRISMA_CODE[prismaCode]) return BY_PRISMA_CODE[prismaCode];

  if (/password authentication failed|authentication failed|role .* does not exist/i.test(msg)) return "DB_AUTH";
  if (/permission denied/i.test(msg)) return "DB_PERMISSION";
  if (/too many connections|remaining connection slots|connection pool/i.test(msg)) return "DB_BUSY";
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|can't reach database server|timed out|ETIMEDOUT/i.test(msg)) return "DB_UNREACHABLE";
  if (/\bSSL\b|\bTLS\b|sslmode/i.test(msg)) return "DB_TLS";
  if (/database .* does not exist/i.test(msg)) return "DB_MISSING";
  if (/does not exist/i.test(msg) && /relation|table|column/i.test(msg)) return "DB_SCHEMA";

  if (e instanceof Prisma.PrismaClientInitializationError || e instanceof Prisma.PrismaClientRustPanicError) return "DB_ERROR";
  return null;
}

export const infraMessage = (code: string) => `The service is temporarily unavailable (${code}). Please try again shortly, or tell your administrator this code.`;
