import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getDatabase } from "@/lib/server/database";
import { getSession, verifyResourceToken } from "@/lib/server/auth";

export const runtime = "nodejs";

/**
 * Serves a Proforma Invoice document.
 *
 * Two accepted callers:
 *   1. ChakraHQ/Meta fetching the WhatsApp document — authenticated by a signed
 *      `?t=` resource token (unguessable, scoped to this one invoice).
 *   2. A logged-in dashboard user — authenticated by session cookie.
 *
 * Falls back to serving the HTML (printable) when the PDF wasn't generated
 * (e.g. Puppeteer not installed in the current environment).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  const authorized = verifyResourceToken("invoice", id, token) || Boolean(getSession(req));
  if (!authorized) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const db = getDatabase();
  const inv = db.prepare(`SELECT pi_number, pdf_path, html_path FROM invoices WHERE id = ?`).get(id) as
    | { pi_number: string; pdf_path: string | null; html_path: string | null }
    | undefined;
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  try {
    if (inv.pdf_path) {
      const buf = await readFile(inv.pdf_path);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${inv.pi_number}.pdf"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    }
    if (inv.html_path) {
      const html = await readFile(inv.html_path, "utf8");
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
  } catch (e) {
    return NextResponse.json({ error: "Document not available", detail: String(e) }, { status: 404 });
  }
  return NextResponse.json({ error: "Document not available" }, { status: 404 });
}
