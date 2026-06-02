import type { GameMasterConfig } from "@advergaming/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (isRecord(value) && isRecord(result[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function readCatchGameSlice(config: GameMasterConfig): Record<string, unknown> {
  const system = config.system as unknown as Record<string, unknown>;
  const slice = system.catchGame;
  return isRecord(slice) ? slice : {};
}

function readCatchGameBranding(config: GameMasterConfig): Record<string, unknown> {
  const branding = config.branding as unknown as Record<string, unknown>;
  const slice = branding.catchGame;
  return isRecord(slice) ? slice : {};
}

/** Merges Studio `catchGame.*` paths into a legacy `public/config.json` shape for export. */
export function mergeStudioConfigIntoLegacyConfig(
  base: Record<string, unknown>,
  master: GameMasterConfig,
): Record<string, unknown> {
  const merged = structuredClone(base);
  const fromSystem = readCatchGameSlice(master);
  const fromBranding = readCatchGameBranding(master);

  if (Object.keys(fromSystem).length > 0) {
    deepMerge(merged, fromSystem);
  }
  if (Object.keys(fromBranding).length > 0) {
    deepMerge(merged, fromBranding);
  }

  return merged;
}
