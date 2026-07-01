import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError, hashPassword, type Role } from "@/lib/server/auth";

export const runtime = "nodejs";

const VALID_ROLES: Role[] = ["owner", "dev", "manager", "accounts"];

/** GET /api/admin/users — list users (owner only). */
export async function GET(req: Request) {
  try {
    assertRole(req, ["owner"]);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const rows = getDatabase()
    .prepare(`SELECT username, role, name, active, created_at, last_login_at FROM users ORDER BY created_at`)
    .all();
  return NextResponse.json({ users: rows });
}

/**
 * POST /api/admin/users — create a user (owner only).
 * Body: { username, password, role, name }
 * Lets the owner provision the dev/manager/accounts accounts whose names appear
 * on approval stamps (Guidelines §8).
 */
export async function POST(req: Request) {
  try {
    assertRole(req, ["owner"]);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }

  let body: { username?: string; password?: string; role?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";
  const role = (body.role || "manager") as Role;
  const name = (body.name || username).trim();

  if (!username || password.length < 8) {
    return NextResponse.json({ error: "username and password (min 8 chars) required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  const db = getDatabase();
  if (db.prepare(`SELECT 1 FROM users WHERE username = ?`).get(username)) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }
  db.prepare(`INSERT INTO users (id, username, password_hash, role, name) VALUES (?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    username,
    hashPassword(password),
    role,
    name
  );
  return NextResponse.json({ ok: true, user: { username, role, name } }, { status: 201 });
}

