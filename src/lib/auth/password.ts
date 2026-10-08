import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

/** Imported accounts get an unusable hash until the user redeems an invite. "!" is never valid bcrypt. */
export const unusablePasswordHash = () => `!${randomBytes(24).toString("hex")}`;

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash.startsWith("$2")) return false;
  return bcrypt.compare(plain, hash);
}

// Compared against when the email is unknown so response time does not reveal which emails exist.
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword("not-a-real-password"));

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
