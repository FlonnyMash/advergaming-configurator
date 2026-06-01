import type {
  BrandingPatch,
  BrandingSettings,
  ControlFieldSchema,
  ControlValue,
  GameMasterConfig,
  GameSchema,
  GameTemplateId,
  LegacyGameMasterConfig,
  SystemSettings,
} from "./types";
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
  const parts = path.split(".");
  let current: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (!isRecord(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function getByPath(
  root: Record<string, unknown>,
  path: string,
): ControlValue | undefined {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
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
  if (isGameMasterConfigShape(data)) {
    return data;
  }
  if (isLegacyGameMasterConfig(data)) {
    return migrateLegacyConfig(data, templateId);
  }
  return null;
}

function isGameMasterConfigShape(data: unknown): data is GameMasterConfig {
  if (!isRecord(data)) return false;
  if (!isRecord(data.meta) || !isRecord(data.system) || !isRecord(data.branding)) {
    return false;
  }
  const branding = data.branding;
  if (!isRecord(branding.theme)) return false;
  if (typeof branding.theme.primaryColor !== "string") return false;
  return true;
}

function isLegacyGameMasterConfig(
  data: unknown,
): data is LegacyGameMasterConfig {
  if (!isRecord(data)) return false;
  return (
    "theme" in data &&
    "gameplay" in data &&
    "domOverlay" in data &&
    !("system" in data)
  );
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
