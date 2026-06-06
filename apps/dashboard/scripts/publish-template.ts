#!/usr/bin/env node
/**
 * Promotes a template from draft → published by updating its manifest.json in-place.
 * No files are copied or moved; the status field is the single source of truth.
 *
 * Usage: pnpm publish-template <template-id>
 * Example: pnpm publish-template my-game-template
 */
import {
  isTemplateManifest,
  type TemplateManifest,
} from "@mashedgames/shared";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  nextVersionForPublish,
  writePublishedSystemJson,
} from "../src/lib/template-publish";

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

  const nextVersion = nextVersionForPublish(currentManifest);

  const publishedManifest: TemplateManifest = {
    ...currentManifest,
    version: nextVersion,
    status: "published",
  };

  writeManifest(templateDir, publishedManifest);
  writePublishedSystemJson(templateDir, publishedManifest);

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
