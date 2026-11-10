/**
 * Password hashing.
 *
 * Deliberately free of any Next.js import so it can be unit-tested with
 * plain node. scrypt from node:crypto — no native dependency, no bcrypt
 * build step.
 *
 * Format: scrypt$N$r$p$salt(hex)$hash(hex)
 */
import crypto from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString("hex"),
    hash.toString("hex"),
  ].join("$");
}

/** Constant-time verification. Never throws on malformed stored hashes. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6) return false;
    const [scheme, n, r, p, saltHex, hashHex] = parts;
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Burn roughly the same amount of work as a real verification, so a missing
 * account is not distinguishable from a wrong password by response time.
 */
export function fakeVerify(password: string): void {
  crypto.scryptSync(password, crypto.randomBytes(16), KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 64 * 1024 * 1024,
  });
}
