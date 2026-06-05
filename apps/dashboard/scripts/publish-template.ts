#!/usr/bin/env node
/**
 * Copies a template from development/ to library/ and bumps manifest version.
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
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(scriptDir, "..");
const engineTemplatesRoot = path.resolve(
  dashboardRoot,
  "../game-engine/src/templates",
);
const developmentRoot = path.join(engineTemplatesRoot, "development");
const libraryRoot = path.join(engineTemplatesRoot, "library");

function copyDirectoryRecursive(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destinationPath);
      continue;
    }

    cpSync(sourcePath, destinationPath);
  }
}

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

  const sourceDir = path.join(developmentRoot, templateId);
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    console.error(`Development template not found: ${sourceDir}`);
    process.exit(1);
  }

  const destinationDir = path.join(libraryRoot, templateId);
  const previousLibraryManifest = existsSync(destinationDir)
    ? readManifest(destinationDir)
    : null;

  const sourceManifest = readManifest(sourceDir);

  if (existsSync(destinationDir)) {
    rmSync(destinationDir, { recursive: true, force: true });
  }

  copyDirectoryRecursive(sourceDir, destinationDir);

  const nextVersion = previousLibraryManifest
    ? bumpSemverPatch(previousLibraryManifest.version)
    : sourceManifest.version.startsWith("0.")
      ? "1.0.0"
      : bumpSemverPatch(sourceManifest.version);

  const publishedManifest: TemplateManifest = {
    ...sourceManifest,
    version: nextVersion,
    status: "production",
  };

  writeManifest(destinationDir, publishedManifest);

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
  const publishedSystemPath = path.join(
    destinationDir,
    "published-system.json",
  );
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

  console.log(`Published "${templateId}" to library/ at v${nextVersion}`);
}

main();
