import { NextResponse } from "next/server";
import {
  findUserByUsername,
  verifyPassword,
  createSessionToken,
  serializeSessionCookie,
  recordLogin,
  type Role,
} from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const user = findUserByUsername(username);
  // Constant-ish response: do not reveal whether the username exists.
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken({ id: user.id, username: user.username, role: user.role as Role, name: user.name });
  recordLogin(user.id);

  const res = NextResponse.json({
    user: { username: user.username, role: user.role, name: user.name || user.username },
  });
  res.headers.set("Set-Cookie", serializeSessionCookie(token));
  return res;
}

