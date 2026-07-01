import { NextResponse } from "next/server";
import { assertRole, AuthError } from "@/lib/server/auth";
import { listTemplateIds, availableLanguages, renderTemplate } from "@/lib/server/services/templates";

export const runtime = "nodejs";

/**
 * GET /api/templates/registry — inspect the native template registry.
 *   ?id=T11&lang=gujarati  → preview a rendered native variant.
 *   (no params)            → list template ids + available languages.
 */
export async function GET(req: Request) {
  try {
    assertRole(req, ["owner", "dev", "manager"]);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const lang = url.searchParams.get("lang");

  if (id) {
    const preview = renderTemplate(id, lang, {
      CLIENT_NAME: "Ramesh", ORDER_ID: "ORD-2026-0042", TOKEN_MIN: "9,600", TOKEN_MAX: "24,000",
      PAYMENT_DETAILS: "AXIS BANK …", TOTAL_VALUE: "96,000", SPEC: "36\" 5.0g Gold", QTY: "1000kg",
      DISPATCH_DATE: "27/06/2026", NEW_ETA: "27/06/2026", OLD_ETA: "25/06/2026", REASON: "production pace",
      TOKEN_AMT: "15,000", ETA_DATE: "27/06/2026", VEHICLE_NO: "GJ-05-AB-1234",
    });
    return NextResponse.json({ id, requestedLang: lang, ...preview });
  }

  return NextResponse.json({ templateIds: listTemplateIds(), languages: availableLanguages() });
}

