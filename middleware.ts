import { NextResponse, type NextRequest } from "next/server";

/**
 * Authentication middleware (edge).
 *
 * Authoritatively verifies the HMAC-signed session cookie using Web Crypto, so
 * forged cookies cannot reach any protected route. This closes the "every
 * dashboard/admin route is unauthenticated" hole (audit P0-2). Mutating route
 * handlers additionally call `assertRole()` for per-role checks (defense in
 * depth — never trust middleware alone for fine-grained authz).
 *
 * Public (no auth): the two ChakraHQ webhooks (HMAC-verified separately), the
 * auth endpoints, the login page, health, and Next internals/static assets.
 */

const COOKIE_NAME = "flowzint_session";

const PUBLIC_PREFIXES = [
  "/api/webhook",
  "/api/auth",
  "/api/system/status",
  "/api/invoices", // PI document fetch — protected by a signed ?t= resource token
  "/login",
  "/_next",
  "/favicon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function b64urlToUint8(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "dev-insecure-session-secret-change-me" : "");
  if (!secret) return false;
  const [body, sig] = token.split(".");
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    if (bufToB64url(mac) !== sig) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToUint8(body)));
    return typeof payload.exp === "number" && payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const ok = await verifySession(token);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Match everything except Next static assets; logic above allow-lists publics.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
