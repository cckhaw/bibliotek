import { describe, expect, it } from "vitest";
import { classifyInfraError, infraMessage } from "@/lib/infra-errors";

const prismaLike = (errorCode: string, message = "x") => Object.assign(new Error(message), { errorCode });

describe("classifyInfraError", () => {
  it("maps Prisma connection/auth codes", () => {
    expect(classifyInfraError(prismaLike("P1000"))).toBe("DB_AUTH");
    expect(classifyInfraError(prismaLike("P1001"))).toBe("DB_UNREACHABLE");
    expect(classifyInfraError(prismaLike("P1011"))).toBe("DB_TLS");
    expect(classifyInfraError(Object.assign(new Error("x"), { code: "P2021" }))).toBe("DB_SCHEMA");
    expect(classifyInfraError(Object.assign(new Error("x"), { code: "P2024" }))).toBe("DB_BUSY");
  });
  it("recognises common database messages", () => {
    expect(classifyInfraError(new Error('password authentication failed for user "x"'))).toBe("DB_AUTH");
    expect(classifyInfraError(new Error("permission denied for table users"))).toBe("DB_PERMISSION");
    expect(classifyInfraError(new Error("getaddrinfo ENOTFOUND db.example.com"))).toBe("DB_UNREACHABLE");
    expect(classifyInfraError(new Error("remaining connection slots are reserved"))).toBe("DB_BUSY");
    expect(classifyInfraError(new Error('relation "users" does not exist'))).toBe("DB_SCHEMA");
    expect(classifyInfraError(new Error("Invalid environment configuration — AUTH_SECRET: too short"))).toBe("ENV_INVALID");
  });
  it("ignores ordinary application errors", () => {
    expect(classifyInfraError(new Error("Student not found"))).toBeNull();
    expect(classifyInfraError("nope")).toBeNull();
  });
  it("the user-facing message carries only the safe code", () => {
    expect(infraMessage("DB_AUTH")).toContain("(DB_AUTH)");
  });
});

describe("more cases", () => {
  it("a missing database is DB_MISSING, a missing table is DB_SCHEMA", () => {
    expect(classifyInfraError(new Error("Database `wrongdb` does not exist on the database server"))).toBe("DB_MISSING");
    expect(classifyInfraError(new Error('relation "users" does not exist'))).toBe("DB_SCHEMA");
  });
});
