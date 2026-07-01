import crypto from "node:crypto";
import { getDatabase } from "./database";

/**
 * Lightweight, dependency-free authentication.
 *
 *  - Passwords: scrypt with a per-password random salt (Node built-in crypto).
 *  - Sessions:  stateless HMAC-signed token stored in an HttpOnly cookie.
 *
 * This is the authoritative authorization layer. `middleware.ts` performs a
 * cheap presence/expiry gate for UX, but every mutating API route MUST call
 * `assertRole()` (defense in depth — never trust middleware alone for authz).
 */

export const COOKIE_NAME = "flowzint_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export type Role = "owner" | "dev" | "manager" | "accounts";

/** Approval authority order from Guidelines §8 (Puneet → Dev → Manager). */
export const APPROVER_ROLES: Role[] = ["owner", "dev", "manager"];

export type Session = {
  uid: string;
  username: string;
  role: Role;
  name: string;
  exp: number; // unix seconds
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (>=16 chars) in production");
  }
  // Dev fallback only — stable across reloads but never used in prod.
  return "dev-insecure-session-secret-change-me";
}

// ── Password hashing ────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ── Session token (HMAC-signed, stateless) ──────────────────────────────────

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function createSessionToken(user: { id: string; username: string; role: Role; name?: string | null }): string {
  const payload: Session = {
    uid: user.id,
    username: user.username,
    role: user.role,
    name: user.name || user.username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

// ── Request helpers ─────────────────────────────────────────────────────────

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function getSession(req: Request): Session | null {
  return verifySessionToken(readCookie(req, COOKIE_NAME));
}

/**
 * Authoritative authorization guard for API route handlers.
 * Throws AuthError(401) if unauthenticated, AuthError(403) if role not allowed.
 */
export function assertRole(req: Request, allowed: Role[]): Session {
  const session = getSession(req);
  if (!session) throw new AuthError("Authentication required", 401);
  if (!allowed.includes(session.role)) throw new AuthError("Insufficient permissions", 403);
  return session;
}

/** Build the standard approval stamp string from Guidelines §8. */
export function approvalStamp(action: string, approverName: string, when: Date = new Date()): string {
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  const date = when.toLocaleDateString("en-GB"); // DD/MM/YYYY
  return `${action} by ${approverName} at ${hh}:${mm}, ${date}`;
}

// ── User lookup ─────────────────────────────────────────────────────────────

export function findUserByUsername(username: string) {
  const db = getDatabase();
  return db
    .prepare(`SELECT id, username, password_hash, role, name, active FROM users WHERE username = ?`)
    .get(username) as
    | { id: string; username: string; password_hash: string; role: Role; name: string | null; active: number }
    | undefined;
}

export function recordLogin(userId: string) {
  getDatabase().prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(userId);
}

export function serializeSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

// ── Signed resource tokens (for public-but-unguessable document links) ───────
// Used to let ChakraHQ/Meta fetch a specific Proforma Invoice PDF without
// exposing every invoice. The token is an HMAC over `${kind}:${id}`.

export function signResourceToken(kind: string, id: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(`${kind}:${id}`).digest("base64url");
}

export function verifyResourceToken(kind: string, id: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = signResourceToken(kind, id);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
