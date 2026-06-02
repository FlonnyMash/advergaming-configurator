import {
  GameMasterConfigSchema,
  LegacyGameMasterConfigSchema,
  type BrandingPatch,
  type BrandingSettings,
  type ControlFieldSchema,
  type ControlValue,
  type GameMasterConfig,
  type GameSchema,
  type GameTemplateId,
  type LegacyGameMasterConfig,
  type SystemSettings,
} from "./game-schema";
import {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_GAME_MASTER_CONFIG,
  DEFAULT_SCHEMA_VERSION,
  DEFAULT_SYSTEM_SETTINGS,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: ControlValue,
): void {
  applyPath(target, path, value);
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

export function migrateLegacyConfig(
  legacy: LegacyGameMasterConfig,
  templateId: GameTemplateId = DEFAULT_GAME_MASTER_CONFIG.meta.templateId,
): GameMasterConfig {
  return {
    meta: {
      templateId,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
    },
    system: {
      ...structuredClone(DEFAULT_SYSTEM_SETTINGS),
      mechanics: {
        ...DEFAULT_SYSTEM_SETTINGS.mechanics,
        playerSpeed: legacy.gameplay.playerSpeed,
      },
    },
    branding: {
      ...structuredClone(DEFAULT_BRANDING_SETTINGS),
      theme: {
        ...DEFAULT_BRANDING_SETTINGS.theme,
        primaryColor: legacy.theme.primaryColor,
        playerTexture: legacy.theme.playerTexture,
      },
      domOverlay: { ...legacy.domOverlay },
    },
  };
}

export function normalizeGameMasterConfig(
  data: unknown,
  templateId?: GameTemplateId,
): GameMasterConfig | null {
  const parsed = GameMasterConfigSchema.safeParse(data);
  if (parsed.success) {
    return parsed.data;
  }

  const legacy = LegacyGameMasterConfigSchema.safeParse(data);
  if (legacy.success) {
    return migrateLegacyConfig(legacy.data, templateId);
  }

  return null;
}

export function buildConfigFromSchema(
  schema: GameSchema,
  templateId: GameTemplateId = schema.id,
): GameMasterConfig {
  const config: GameMasterConfig = {
    meta: {
      templateId,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
    },
    system: structuredClone(DEFAULT_SYSTEM_SETTINGS),
    branding: structuredClone(DEFAULT_BRANDING_SETTINGS),
  };

  for (const control of schema.controls) {
    const slice =
      control.targetCategory === "system"
        ? (config.system as unknown as Record<string, unknown>)
        : (config.branding as unknown as Record<string, unknown>);
    setByPath(slice, control.targetPath, control.defaultValue);
  }

  config.meta.templateId = templateId;
  return config;
}

export function buildConfigWithFrozenSystem(
  schema: GameSchema,
  systemDefaults: SystemSettings,
  templateId: GameTemplateId = schema.id,
): GameMasterConfig {
  const config = buildConfigFromSchema(schema, templateId);
  config.system = structuredClone(systemDefaults);
  config.system.physics.debugDraw = false;
  return config;
}

export function getConfigValue(
  config: GameMasterConfig,
  control: ControlFieldSchema,
): ControlValue {
  const slice =
    control.targetCategory === "system"
      ? (config.system as unknown as Record<string, unknown>)
      : (config.branding as unknown as Record<string, unknown>);
  const value = getByPath(slice, control.targetPath);
  if (value !== undefined) return value;
  return control.defaultValue;
}

export function mergeBrandingPatch(
  config: GameMasterConfig,
  patch: BrandingPatch,
): GameMasterConfig {
  return {
    ...config,
    branding: deepMerge(
      config.branding as unknown as Record<string, unknown>,
      patch as unknown as Record<string, unknown>,
    ) as unknown as BrandingSettings,
  };
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

export function exportClientPayload(
  config: GameMasterConfig,
): Pick<GameMasterConfig, "meta" | "branding"> {
  return {
    meta: { ...config.meta },
    branding: structuredClone(config.branding),
  };
}
