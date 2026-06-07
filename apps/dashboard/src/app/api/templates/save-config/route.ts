import {
  GameConfigSchema,
  normalizeGameConfig,
  type GameConfig,
} from "@mashedgames/shared";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { ensureWorkspaceExists, templateLibraryRoot } from "@/lib/project-paths";
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

  try {
    const body = (await request.json()) as { config?: unknown };
    const normalized = normalizeGameConfig(body.config);
    const parsed = GameConfigSchema.safeParse({
      ...normalized,
      activeTemplateId: templateId,
    });
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "Invalid studio config." },
        { status: 400 },
      );
    }

    ensureWorkspaceExists();
    const templateDir = path.join(templateLibraryRoot, templateId);
    mkdirSync(templateDir, { recursive: true });
    const configPath = path.join(templateDir, "config.json");
    writeFileSync(configPath, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");

    return Response.json({
      ok: true,
      templateId,
      wroteConfig: existsSync(configPath),
      wroteManifest: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
