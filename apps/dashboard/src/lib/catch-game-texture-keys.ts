import type { GameConfig } from "@mashedgames/shared";

function readEntityIdAtPath(
  config: Record<string, unknown> | GameConfig | undefined,
  targetPath: string,
): string | null {
  if (!config) {
    return null;
  }

  const entityMatch = /^(catchableItems|hazardItems)\.(\d+)\.assetUrl$/.exec(
    targetPath,
  );
  if (!entityMatch) {
    return null;
  }

  const arrayKey = entityMatch[1]!;
  const index = Number(entityMatch[2]);
  const items = (config as Record<string, unknown>)[arrayKey];
  if (!Array.isArray(items)) {
    return null;
  }

  const item = items[index];
  if (typeof item !== "object" || item === null) {
    return null;
  }

  const id = (item as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Maps dashboard control paths to Phaser texture keys used by CatchGameScene. */
export function textureKeyForTargetPath(
  targetPath: string,
  config?: Record<string, unknown> | GameConfig,
): string | null {
  if (targetPath === "playerEntity.assetUrl") {
    return "catch_player";
  }

  const entityId = readEntityIdAtPath(config, targetPath);
  if (entityId) {
    return `catch_entity_${entityId}`;
  }

  return null;
}
