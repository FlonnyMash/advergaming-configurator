import {
  buildConfigWithFrozenSystem,
  gameSchemaFromManifestForMode,
  isTemplateManifest,
  type GameMasterConfig,
  type GameTemplateId,
  type SystemSettings,
  type TemplateManifest,
} from "@advergaming/shared";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { templateLibraryRoot } from "@/lib/project-paths";

export function readParentManifest(
  parentTemplateId: GameTemplateId,
): TemplateManifest {
  const manifestPath = path.join(
    templateLibraryRoot,
    parentTemplateId,
    "manifest.json",
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`Parent template "${parentTemplateId}" not found.`);
  }
  const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isTemplateManifest(raw)) {
    throw new Error(`Invalid manifest for "${parentTemplateId}".`);
  }
  return raw;
}

export function loadPublishedSystemFromDisk(
  parentTemplateId: GameTemplateId,
): SystemSettings {
  const publishedPath = path.join(
    templateLibraryRoot,
    parentTemplateId,
    "published-system.json",
  );
  if (!existsSync(publishedPath)) {
    throw new Error(
      `Missing published-system.json for "${parentTemplateId}". Publish the template first.`,
    );
  }
  return JSON.parse(readFileSync(publishedPath, "utf8")) as SystemSettings;
}

export function buildLiveParentConfig(
  parentTemplateId: GameTemplateId,
  mode: "configurator" | "studio" = "configurator",
): { manifest: TemplateManifest; config: GameMasterConfig } {
  const manifest = readParentManifest(parentTemplateId);
  const schema = gameSchemaFromManifestForMode(manifest, mode);
  const systemDefaults = loadPublishedSystemFromDisk(parentTemplateId);
  const config = buildConfigWithFrozenSystem(
    schema,
    systemDefaults,
    parentTemplateId,
  );
  config.meta.schemaVersion = manifest.version ?? config.meta.schemaVersion;
  return { manifest, config };
}
