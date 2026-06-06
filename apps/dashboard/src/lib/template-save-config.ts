import {
  getConfigValue,
  isTemplateManifest,
  mergeFlatConfigIntoTemplateJson,
  type GameConfig,
  type TemplateConfigJsonSchema,
  type TemplateManifest,
} from "@mashedgames/shared";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TEMPLATE_ID_PATTERN } from "@/lib/template-import-normalize";
import { resolveTemplateLocation } from "@/lib/template-studio-meta";
import { templateLibraryRoot } from "@/lib/template-library-root";

export { templateLibraryRoot };

function syncManifestSchemaDefaults(
  node: TemplateConfigJsonSchema,
  config: GameConfig,
  defaultCategory: "system" | "branding" = "branding",
): void {
  const xControl = node["x-control"];
  if (xControl) {
    const rawCategory = xControl.targetCategory ?? defaultCategory;
    const targetPath = xControl.targetPath;
    if (
      targetPath &&
      (rawCategory === "system" || rawCategory === "branding")
    ) {
      const control = {
        key: targetPath,
        label: xControl.label,
        type: xControl.type,
        targetCategory: rawCategory,
        targetPath,
        surface: xControl.surface ?? "studio",
        defaultValue: node.default,
      };
      const value = getConfigValue(config, {
        ...control,
        defaultValue:
          typeof control.defaultValue === "string" ||
          typeof control.defaultValue === "number" ||
          typeof control.defaultValue === "boolean" ||
          control.defaultValue === null
            ? control.defaultValue
            : null,
      });
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        node.default = value;
      }
    }
    return;
  }

  if (!node.properties) {
    return;
  }

  for (const child of Object.values(node.properties)) {
    syncManifestSchemaDefaults(child, config, defaultCategory);
  }
}

function buildLegacyConfigJson(
  templateDir: string,
  studioConfig: GameConfig,
): string {
  const configPath = path.join(templateDir, "public", "config.json");
  let base: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    base = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  }
  const merged = mergeFlatConfigIntoTemplateJson(base, studioConfig);
  mkdirSync(path.dirname(configPath), { recursive: true });
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export type SaveTemplateConfigResult =
  | {
      ok: true;
      templateId: string;
      wroteConfig: boolean;
      wroteManifest: boolean;
    }
  | { ok: false; error: string; status: number };

export function saveTemplateConfigToLibrary(
  templateId: string,
  studioConfig: GameConfig,
): SaveTemplateConfigResult {
  if (!TEMPLATE_ID_PATTERN.test(templateId)) {
    return { ok: false, error: "Invalid template ID.", status: 400 };
  }

  const location = resolveTemplateLocation(templateId);
  if (!location) {
    return {
      ok: false,
      error: `Template "${templateId}" was not found.`,
      status: 404,
    };
  }

  const templateDir = location.directoryPath;

  const configPath = path.join(templateDir, "public", "config.json");
  const configJson = buildLegacyConfigJson(templateDir, studioConfig);
  writeFileSync(configPath, configJson, "utf8");

  let wroteManifest = false;
  const manifestPath = path.join(templateDir, "manifest.json");
  if (existsSync(manifestPath)) {
    const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (isTemplateManifest(raw)) {
      const manifest: TemplateManifest = structuredClone(raw);
      syncManifestSchemaDefaults(manifest.schema, studioConfig);
      writeFileSync(
        manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      );
      wroteManifest = true;
    }
  }

  return {
    ok: true,
    templateId,
    wroteConfig: true,
    wroteManifest,
  };
}
