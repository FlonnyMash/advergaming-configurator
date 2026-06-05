import {
  flattenLegacyConfig,
  normalizeGameConfig,
} from "./config-flatten";
import {
  GameConfigSchema,
  type GameConfig,
} from "./game-config-bridge";
import {
  type ControlFieldSchema,
  type ControlValue,
  type GameSchema,
  type GameTemplateId,
} from "./game-schema";
import { DEFAULT_GAME_CONFIG, DEFAULT_SCHEMA_VERSION } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Sets nested values; supports numeric path segments for arrays. */
export function applyPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current: unknown = root;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const nextKey = parts[i + 1]!;
    const nextIsIndex = /^\d+$/.test(nextKey);

    if (Array.isArray(current)) {
      const index = Number(key);
      if (!isRecord(current[index]) && !Array.isArray(current[index])) {
        current[index] = nextIsIndex ? [] : {};
      }
      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return;
    }

    if (
      !(key in current) ||
      current[key] === null ||
      (typeof current[key] !== "object" && !Array.isArray(current[key]))
    ) {
      current[key] = nextIsIndex ? [] : {};
    }
    current = current[key];
  }

  const last = parts[parts.length - 1]!;
  if (Array.isArray(current)) {
    current[Number(last)] = value;
    return;
  }
  if (isRecord(current)) {
    current[last] = value;
  }
}

function getByPath(
  root: Record<string, unknown>,
  path: string,
): ControlValue | undefined {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (Array.isArray(current)) {
      current = current[Number(part)];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  if (
    typeof current === "string" ||
    typeof current === "number" ||
    typeof current === "boolean" ||
    current === null
  ) {
    return current;
  }
  return undefined;
}

export { normalizeGameConfig, flattenLegacyConfig };

export function buildConfigFromSchema(
  schema: GameSchema,
  templateId: GameTemplateId = schema.id,
): GameConfig {
  const config: GameConfig = {
    ...structuredClone(DEFAULT_GAME_CONFIG),
    activeTemplateId: templateId,
    schemaVersion: DEFAULT_SCHEMA_VERSION,
  };

  const root = config as Record<string, unknown>;
  for (const control of schema.controls) {
    applyPath(root, control.targetPath, control.defaultValue);
  }

  return config;
}

export function buildConfigWithFrozenSystem(
  schema: GameSchema,
  systemDefaults: Record<string, unknown>,
  templateId: GameTemplateId = schema.id,
): GameConfig {
  const config = buildConfigFromSchema(schema, templateId);
  const root = config as Record<string, unknown>;
  for (const [key, value] of Object.entries(systemDefaults)) {
    if (key === "catchGame" && isRecord(value)) {
      const existing = isRecord(root.catchGame) ? root.catchGame : {};
      root.catchGame = deepMerge(existing, value);
      continue;
    }
    root[key] = structuredClone(value);
  }
  return config;
}

export function getConfigValue(
  config: GameConfig,
  control: ControlFieldSchema,
): ControlValue {
  const value = getByPath(
    config as Record<string, unknown>,
    control.targetPath,
  );
  if (value !== undefined) return value;
  return control.defaultValue;
}

export function patchConfig(
  config: GameConfig,
  patch: Partial<GameConfig>,
): GameConfig {
  return deepMerge(
    config as Record<string, unknown>,
    patch as Record<string, unknown>,
  ) as GameConfig;
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

export function exportClientPayload(config: GameConfig): GameConfig {
  const {
    activeTemplateId,
    projectId,
    schemaVersion,
    parentTemplateId,
    parentPinnedVersion,
    lastParentSyncAt,
    ...clientFields
  } = config;

  return {
    activeTemplateId,
    projectId,
    schemaVersion,
    parentTemplateId,
    parentPinnedVersion,
    lastParentSyncAt,
    ...structuredClone(clientFields),
  };
}

export function parseGameConfig(data: unknown): GameConfig | null {
  const result = GameConfigSchema.safeParse(data);
  if (result.success) return result.data;
  return flattenLegacyConfig(data);
}
