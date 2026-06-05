import { buildTemplateZip } from "@/lib/template-export";
import {
  normalizeGameConfig,
  type GameConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const templateId = request.nextUrl.searchParams.get("templateId");
  if (!templateId) {
    return Response.json(
      { ok: false, error: "Missing templateId query parameter." },
      { status: 400 },
    );
  }

  const result = buildTemplateZip(templateId);
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${templateId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const templateId = request.nextUrl.searchParams.get("templateId");
  if (!templateId) {
    return Response.json(
      { ok: false, error: "Missing templateId query parameter." },
      { status: 400 },
    );
  }

  let studioConfig: GameConfig | undefined;
  try {
    const body = (await request.json()) as { config?: unknown };
    if (body.config) {
      const normalized = normalizeGameConfig(
        body.config,
        templateId as GameTemplateId,
      );
      if (normalized) {
        studioConfig = normalized;
      }
    }
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const result = buildTemplateZip(templateId, studioConfig);
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${templateId}.zip"`,
      "Cache-Control": "no-store",
      "X-Export-File-Count": String(result.fileCount),
    },
  });
}
