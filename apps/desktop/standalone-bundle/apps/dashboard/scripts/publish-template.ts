#!/usr/bin/env node
/**
 * Promotes a template from draft → published by updating its manifest.json in-place.
 * No files are copied or moved; the status field is the single source of truth.
 *
 * Usage: pnpm publish-template <template-id>
 * Example: pnpm publish-template my-game-template
 */
import {
  applyPath,
  buildConfigFromSchema,
  bumpSemverPatch,
  gameSchemaFromManifest,
  getConfigValue,
  isTemplateManifest,
  type TemplateManifest,
} from "@mashedgames/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(scriptDir, "..");
const templatesRoot = path.resolve(
  dashboardRoot,
  "../game-engine/src/templates",
);

function readManifest(dir: string): TemplateManifest {
  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest.json in ${dir}`);
  }

  const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isTemplateManifest(raw)) {
    throw new Error(`Invalid manifest.json in ${dir}`);
  }
  return raw;
}

function writeManifest(dir: string, manifest: TemplateManifest): void {
  const manifestPath = path.join(dir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function main(): void {
  const templateId = process.argv[2];
  if (!templateId) {
    console.error("Usage: pnpm publish-template <template-id>");
    process.exit(1);
  }

  const templateDir = path.join(templatesRoot, templateId);
  if (!existsSync(templateDir) || !statSync(templateDir).isDirectory()) {
    console.error(`Template not found: ${templateDir}`);
    process.exit(1);
  }

  const currentManifest = readManifest(templateDir);

  const nextVersion =
    currentManifest.status === "published"
      ? bumpSemverPatch(currentManifest.version)
      : currentManifest.version.startsWith("0.")
        ? "1.0.0"
        : bumpSemverPatch(currentManifest.version);

  const publishedManifest: TemplateManifest = {
    ...currentManifest,
    version: nextVersion,
    status: "published",
  };

  writeManifest(templateDir, publishedManifest);

  const schema = gameSchemaFromManifest(publishedManifest);
  const bakedConfig = buildConfigFromSchema(schema, templateId);
  const systemPayload: Record<string, unknown> = {};
  for (const control of schema.controls) {
    if (control.targetCategory !== "system") {
      continue;
    }
    applyPath(systemPayload, control.targetPath, getConfigValue(bakedConfig, control));
  }
  if (isRecord(systemPayload.physics)) {
    systemPayload.physics = { ...systemPayload.physics, debugDraw: false };
  }
  const publishedSystemPath = path.join(templateDir, "published-system.json");
  writeFileSync(
    publishedSystemPath,
    `${JSON.stringify(systemPayload, null, 2)}\n`,
    "utf8",
  );

  const syncResult = spawnSync(
    "node",
    ["--import", "tsx", "scripts/sync-manifest-registry.ts"],
    {
      cwd: path.join(dashboardRoot, "../game-engine"),
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (syncResult.status !== 0) {
    process.exit(syncResult.status ?? 1);
  }

  console.log(`Published "${templateId}" at v${nextVersion} (status updated in-place)`);
}

main();
