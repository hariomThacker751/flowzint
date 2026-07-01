import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError } from "@/lib/server/auth";
import {
  listTemplateIds,
  getTemplateMeta,
  updateVariantBody,
  setVariantApproval,
  validateVariableSets,
} from "@/lib/server/services/templates";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

/** GET /api/admin/templates — list templates + per-variant approval status. */
export async function GET(req: Request) {
  try {
    assertRole(req, ["owner", "dev", "manager"]);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const db = getDatabase();
  const templates = listTemplateIds().map((id) => {
    const meta = getTemplateMeta(id)!;
    const variants = db
      .prepare(`SELECT language, version, approval_status, chakra_template_name FROM template_variants WHERE template_id = ? ORDER BY language`)
      .all(id);
    return { ...meta, variants };
  });
  return NextResponse.json({ templates, variableSetIssues: validateVariableSets() });
}

/**
 * POST /api/admin/templates — edit a variant body (versioned) and/or set its
 * approval status + ChakraHQ template name (owner only).
 * Body: { id, language, body?, approvalStatus?, chakraName? }
 */
export async function POST(req: Request) {
  let actor: string;
  try {
    actor = assertRole(req, ["owner"]).name;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, language, body: newBody, approvalStatus, chakraName } = body as {
      id?: string; language?: string; body?: string; approvalStatus?: string; chakraName?: string;
    };
    if (!id || !language) return NextResponse.json({ error: "id and language required" }, { status: 400 });
    if (!getTemplateMeta(id)) return NextResponse.json({ error: `Unknown template ${id}` }, { status: 404 });

    const changed: string[] = [];
    if (typeof newBody === "string" && newBody.trim()) {
      updateVariantBody(id, language, newBody, actor);
      changed.push("body(version+1)");
    }
    if (approvalStatus || chakraName) {
      const valid = ["draft", "submitted", "approved", "rejected"];
      if (approvalStatus && !valid.includes(approvalStatus)) {
        return NextResponse.json({ error: `approvalStatus must be one of ${valid.join(", ")}` }, { status: 400 });
      }
      setVariantApproval(id, language, approvalStatus || "draft", chakraName);
      changed.push("approval/chakraName");
    }
    if (!changed.length) return NextResponse.json({ error: "Nothing to update (provide body and/or approvalStatus/chakraName)" }, { status: 400 });

    await appendLog("template_admin_update", { id, language, changed, by: actor });
    return NextResponse.json({ ok: true, id, language, changed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

