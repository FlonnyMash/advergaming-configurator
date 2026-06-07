import { saveTemplateConfigToLibrary } from "@/lib/template-save-config";
import {
  normalizeGameMasterConfig,
  type GameMasterConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const templateId = request.nextUrl.searchParams.get("templateId");
  if (!templateId) {
    return Response.json(
      { ok: false, error: "Missing templateId query parameter." },
      { status: 400 },
    );
  }

  let studioConfig: GameMasterConfig | undefined;
  try {
    const body = (await request.json()) as { config?: unknown };
    if (!body.config) {
      return Response.json(
        { ok: false, error: "Missing config in request body." },
        { status: 400 },
      );
    }
    const normalized = normalizeGameMasterConfig(
      body.config,
      templateId as GameTemplateId,
    );
    if (!normalized) {
      return Response.json(
        { ok: false, error: "Invalid studio config." },
        { status: 400 },
      );
    }
    studioConfig = normalized;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const result = saveTemplateConfigToLibrary(templateId, studioConfig);
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return Response.json({
    ok: true,
    templateId: result.templateId,
    wroteConfig: result.wroteConfig,
    wroteManifest: result.wroteManifest,
  });
}
