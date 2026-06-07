import { GameConfigSchema, type GameConfig } from "@mashedgames/shared";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { templateLibraryRoot } from "@/lib/project-paths";

export function buildTemplateZip(templateId: string):
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number } {
  const configPath = path.join(templateLibraryRoot, templateId, "config.json");
  if (!existsSync(configPath)) {
    return { ok: false, error: `Template "${templateId}" not found.`, status: 404 };
  }

  const config = readFileSync(configPath, "utf8");
  return { ok: true, buffer: Buffer.from(config, "utf8") };
}

export function mergeFlatConfigIntoTemplateJson(
  templateJson: Record<string, unknown>,
  config: GameConfig,
): Record<string, unknown> {
  return {
    ...templateJson,
    ...GameConfigSchema.parse(config),
  };
}

export async function exportTemplateToDirectory(
  templateId: string,
  targetDir: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  void templateId;
  void targetDir;
  return { ok: false, error: "Deploy export is unavailable after reset.", status: 501 };
}
