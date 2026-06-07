import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_SCHEMA_VERSION,
  type GameConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import { existsSync } from "node:fs";
import path from "node:path";
import { templateLibraryRoot } from "@/lib/project-paths";

export type ParentTemplateManifest = {
  id: GameTemplateId;
  version: string;
  status: "published" | "draft";
};

const DEFAULT_PARENT: ParentTemplateManifest = {
  id: DEFAULT_GAME_CONFIG.activeTemplateId,
  version: DEFAULT_SCHEMA_VERSION,
  status: "published",
};

function configPath(parentTemplateId: GameTemplateId): string {
  return path.join(templateLibraryRoot, parentTemplateId, "config.json");
}

export function isParentTemplateInLibrary(
  parentTemplateId: GameTemplateId,
): boolean {
  if (parentTemplateId === DEFAULT_GAME_CONFIG.activeTemplateId) {
    return true;
  }
  return existsSync(configPath(parentTemplateId));
}

export function readParentManifest(
  parentTemplateId: GameTemplateId,
): ParentTemplateManifest {
  if (isParentTemplateInLibrary(parentTemplateId)) {
    return {
      id: parentTemplateId,
      version: DEFAULT_SCHEMA_VERSION,
      status: "published",
    };
  }
  throw new Error(`Parent template "${parentTemplateId}" not found.`);
}

export function buildLiveParentConfig(
  parentTemplateId: GameTemplateId,
): { manifest: ParentTemplateManifest; config: GameConfig } {
  const manifest = readParentManifest(parentTemplateId);
  return {
    manifest,
    config: {
      ...DEFAULT_GAME_CONFIG,
      activeTemplateId: parentTemplateId,
      schemaVersion: manifest.version,
    },
  };
}
