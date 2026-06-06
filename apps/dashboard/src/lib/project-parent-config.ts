import {
  buildConfigWithFrozenSystem,
  gameSchemaFromManifestForMode,
  getDesktopBundledTemplateIds,
  parseTemplateManifest,
  type GameConfig,
  type GameTemplateId,
  type SystemSettings,
  type TemplateManifest,
} from "@mashedgames/shared";
import {
  getCatalogEntry,
  getPublishedSystemDefaults,
} from "@mashedgames/game-engine/templates/schemas";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { templateLibraryRoot } from "@/lib/project-paths";
import { isWorkspaceDesktop } from "@/lib/runtime-env";

function manifestPath(parentTemplateId: GameTemplateId): string {
  return path.join(templateLibraryRoot, parentTemplateId, "manifest.json");
}

function publishedSystemPath(parentTemplateId: GameTemplateId): string {
  return path.join(
    templateLibraryRoot,
    parentTemplateId,
    "published-system.json",
  );
}

function hasManifestOnDisk(parentTemplateId: GameTemplateId): boolean {
  return existsSync(manifestPath(parentTemplateId));
}

function getRegistryPublishedEntry(parentTemplateId: GameTemplateId) {
  const entry = getCatalogEntry(parentTemplateId);
  if (entry?.manifest.status !== "published") {
    return null;
  }
  return entry;
}

/** Baked catalog when templates/ is not on disk (desktop) or disk path is unavailable. */
function canUseRegistryTemplate(parentTemplateId: GameTemplateId): boolean {
  if (!getRegistryPublishedEntry(parentTemplateId)) {
    return false;
  }

  if (isWorkspaceDesktop()) {
    const bundled = getDesktopBundledTemplateIds();
    if (bundled && !bundled.includes(parentTemplateId)) {
      return false;
    }
  }

  return true;
}

/** True when the template is on disk in templates/ or in the production catalog registry. */
export function isParentTemplateInLibrary(
  parentTemplateId: GameTemplateId,
): boolean {
  return (
    hasManifestOnDisk(parentTemplateId) ||
    canUseRegistryTemplate(parentTemplateId)
  );
}

export function readParentManifest(
  parentTemplateId: GameTemplateId,
): TemplateManifest {
  if (hasManifestOnDisk(parentTemplateId)) {
    const raw: unknown = JSON.parse(
      readFileSync(manifestPath(parentTemplateId), "utf8"),
    );
    const manifest = parseTemplateManifest(raw);
    if (!manifest) {
      throw new Error(`Invalid manifest for "${parentTemplateId}".`);
    }
    return manifest;
  }

  const entry = getRegistryPublishedEntry(parentTemplateId);
  if (entry && canUseRegistryTemplate(parentTemplateId)) {
    return entry.manifest;
  }

  throw new Error(`Parent template "${parentTemplateId}" not found.`);
}

export function loadPublishedSystemFromDisk(
  parentTemplateId: GameTemplateId,
): SystemSettings {
  if (existsSync(publishedSystemPath(parentTemplateId))) {
    return JSON.parse(
      readFileSync(publishedSystemPath(parentTemplateId), "utf8"),
    ) as SystemSettings;
  }

  if (canUseRegistryTemplate(parentTemplateId)) {
    return getPublishedSystemDefaults(parentTemplateId);
  }

  throw new Error(
    `Missing published-system.json for "${parentTemplateId}". Publish the template first.`,
  );
}

export function buildLiveParentConfig(
  parentTemplateId: GameTemplateId,
  mode: "configurator" | "studio" = "configurator",
): { manifest: TemplateManifest; config: GameConfig } {
  const manifest = readParentManifest(parentTemplateId);
  const schema = gameSchemaFromManifestForMode(manifest, mode);
  const systemDefaults = loadPublishedSystemFromDisk(parentTemplateId);
  const config = buildConfigWithFrozenSystem(
    schema,
    systemDefaults,
    parentTemplateId,
  );
  config.schemaVersion = manifest.version ?? config.schemaVersion;
  return { manifest, config };
}
