import {
  applyPath,
  buildConfigFromSchema,
  bumpSemverPatch,
  gameSchemaFromManifest,
  getConfigValue,
  type TemplateManifest,
} from "@mashedgames/shared";
import { writeFileSync } from "node:fs";
import path from "node:path";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function nextVersionForPublish(manifest: TemplateManifest): string {
  if (manifest.status === "published") {
    return bumpSemverPatch(manifest.version);
  }
  if (manifest.version.startsWith("0.")) {
    return "1.0.0";
  }
  return bumpSemverPatch(manifest.version);
}

/** Bake frozen system defaults for configurator projects (no file moves). */
export function writePublishedSystemJson(
  templateDir: string,
  manifest: TemplateManifest,
): void {
  const schema = gameSchemaFromManifest(manifest);
  const bakedConfig = buildConfigFromSchema(schema, manifest.id);
  const systemPayload: Record<string, unknown> = {};

  for (const control of schema.controls) {
    if (control.targetCategory !== "system") {
      continue;
    }
    applyPath(
      systemPayload,
      control.targetPath,
      getConfigValue(bakedConfig, control),
    );
  }

  if (isRecord(systemPayload.physics)) {
    systemPayload.physics = { ...systemPayload.physics, debugDraw: false };
  }

  writeFileSync(
    path.join(templateDir, "published-system.json"),
    `${JSON.stringify(systemPayload, null, 2)}\n`,
    "utf8",
  );
}
