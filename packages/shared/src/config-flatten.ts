import { GameConfigSchema, type GameConfig } from "./game-config-bridge";
import { DEFAULT_GAME_CONFIG, DEFAULT_SCHEMA_VERSION } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getByPath(
  root: Record<string, unknown>,
  path: string,
): unknown {
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
  return current;
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

function mergeCatchGameBlocks(
  branding: Record<string, unknown>,
  system: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const brandingCatch = branding.catchGame;
  const systemCatch = system.catchGame;
  if (!isRecord(brandingCatch) && !isRecord(systemCatch)) {
    return undefined;
  }
  return deepMerge(
    isRecord(brandingCatch) ? { ...brandingCatch } : {},
    isRecord(systemCatch) ? { ...systemCatch } : {},
  );
}

function flattenNestedMasterConfig(
  data: Record<string, unknown>,
): GameConfig | null {
  const meta = isRecord(data.meta) ? data.meta : {};
  const system = isRecord(data.system) ? data.system : {};
  const branding = isRecord(data.branding) ? data.branding : {};

  const flat: Record<string, unknown> = {
    activeTemplateId:
      typeof meta.templateId === "string"
        ? meta.templateId
        : DEFAULT_GAME_CONFIG.activeTemplateId,
    schemaVersion:
      typeof meta.schemaVersion === "string"
        ? meta.schemaVersion
        : DEFAULT_SCHEMA_VERSION,
  };

  if (typeof meta.projectId === "string") flat.projectId = meta.projectId;
  if (typeof meta.parentTemplateId === "string") {
    flat.parentTemplateId = meta.parentTemplateId;
  }
  if (typeof meta.parentPinnedVersion === "string") {
    flat.parentPinnedVersion = meta.parentPinnedVersion;
  }
  if (typeof meta.lastParentSyncAt === "string") {
    flat.lastParentSyncAt = meta.lastParentSyncAt;
  }

  const theme = isRecord(branding.theme) ? branding.theme : {};
  if (typeof theme.primaryColor === "string") {
    flat.themeColor = theme.primaryColor;
  }
  if (theme.logoTexture !== undefined) {
    flat.logoUrl = theme.logoTexture;
  }
  if (theme.playerTexture !== undefined && flat.logoUrl === undefined) {
    flat.playerTexture = theme.playerTexture;
  }
  if (typeof theme.fontFamily === "string") {
    flat.fontFamily = theme.fontFamily;
  }
  if (typeof theme.secondaryColor === "string") {
    flat.secondaryColor = theme.secondaryColor;
  }

  if (isRecord(branding.domOverlay)) {
    flat.domOverlay = { ...branding.domOverlay };
  }
  if (isRecord(branding.localization)) {
    flat.localization = { ...branding.localization };
  }
  if (isRecord(branding.gamification)) {
    flat.gamification = { ...branding.gamification };
  }
  if (Array.isArray(branding.animationOverrides)) {
    flat.animationOverrides = branding.animationOverrides;
  }

  const catchGame = mergeCatchGameBlocks(branding, system);
  if (catchGame) {
    flat.catchGame = catchGame;
  }

  for (const [key, value] of Object.entries(system)) {
    if (key === "catchGame") continue;
    flat[key] = value;
  }

  for (const [key, value] of Object.entries(branding)) {
    if (
      key === "catchGame" ||
      key === "theme" ||
      key === "domOverlay" ||
      key === "localization" ||
      key === "gamification" ||
      key === "animationOverrides"
    ) {
      continue;
    }
    flat[key] = value;
  }

  const parsed = GameConfigSchema.safeParse(flat);
  return parsed.success ? parsed.data : null;
}

function flattenLegacyFlatConfig(
  data: Record<string, unknown>,
  templateId?: string,
): GameConfig | null {
  const flat: Record<string, unknown> = {
    activeTemplateId: templateId ?? DEFAULT_GAME_CONFIG.activeTemplateId,
    schemaVersion: DEFAULT_SCHEMA_VERSION,
  };

  const theme = isRecord(data.theme) ? data.theme : {};
  if (typeof theme.primaryColor === "string") {
    flat.themeColor = theme.primaryColor;
  }
  if (theme.playerTexture !== undefined) {
    flat.playerTexture = theme.playerTexture;
  }

  const gameplay = isRecord(data.gameplay) ? data.gameplay : {};
  if (typeof gameplay.playerSpeed === "number") {
    flat.playerSpeed = gameplay.playerSpeed;
  }

  if (isRecord(data.domOverlay)) {
    flat.domOverlay = { ...data.domOverlay };
  }

  const parsed = GameConfigSchema.safeParse(flat);
  return parsed.success ? parsed.data : null;
}

/** Reads legacy nested or flat workspace JSON and produces canonical flat GameConfig. */
export function flattenLegacyConfig(
  data: unknown,
  templateId?: string,
): GameConfig | null {
  const direct = GameConfigSchema.safeParse(data);
  if (direct.success) return direct.data;

  if (!isRecord(data)) return null;

  if ("meta" in data && "system" in data && "branding" in data) {
    return flattenNestedMasterConfig(data);
  }

  if ("meta" in data && "branding" in data && !("system" in data)) {
    const branding = isRecord(data.branding) ? data.branding : {};
    return flattenNestedMasterConfig({
      meta: data.meta,
      system: {},
      branding,
    });
  }

  if ("theme" in data && "gameplay" in data) {
    return flattenLegacyFlatConfig(data, templateId);
  }

  if (typeof data.activeTemplateId === "string") {
    const parsed = GameConfigSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  }

  return null;
}

export function normalizeGameConfig(
  data: unknown,
  templateId?: string,
): GameConfig | null {
  return flattenLegacyConfig(data, templateId);
}

export function getPrimaryBrandColor(config: GameConfig): string {
  const catchGame = config.catchGame;
  if (isRecord(catchGame)) {
    const game = catchGame.game;
    if (isRecord(game) && typeof game.backgroundColor === "string") {
      return game.backgroundColor;
    }
  }

  const theme = config.theme;
  if (isRecord(theme) && typeof theme.primaryColor === "string") {
    return theme.primaryColor;
  }

  if (typeof config.themeColor === "string") {
    return config.themeColor;
  }

  return DEFAULT_GAME_CONFIG.themeColor ?? "#6366f1";
}

export function getDomOverlayForUi(config: GameConfig): {
  startScreenTitle: string;
  showLeadForm: boolean;
  ctaButtonText: string;
  showHighscores: boolean;
  primaryColor: string;
} {
  const domOverlay = isRecord(config.domOverlay) ? config.domOverlay : {};
  return {
    startScreenTitle:
      typeof domOverlay.startScreenTitle === "string"
        ? domOverlay.startScreenTitle
        : "Play Now",
    showLeadForm:
      typeof domOverlay.showLeadForm === "boolean"
        ? domOverlay.showLeadForm
        : false,
    ctaButtonText:
      typeof domOverlay.ctaButtonText === "string"
        ? domOverlay.ctaButtonText
        : "Start Game",
    showHighscores:
      typeof domOverlay.showHighscores === "boolean"
        ? domOverlay.showHighscores
        : true,
    primaryColor: getPrimaryBrandColor(config),
  };
}

export function getConfigValueAtPath(
  config: GameConfig,
  path: string,
): unknown {
  return getByPath(config as Record<string, unknown>, path);
}

/** Merges flat `catchGame` (and domOverlay) into a template `public/config.json` object. */
export function mergeFlatConfigIntoTemplateJson(
  base: Record<string, unknown>,
  config: GameConfig,
): Record<string, unknown> {
  let merged = { ...base };
  const catchGame = config.catchGame;
  if (isRecord(catchGame)) {
    merged = deepMerge(merged, catchGame) as Record<string, unknown>;
  }
  if (isRecord(config.domOverlay)) {
    merged.domOverlay = { ...config.domOverlay };
  }
  return merged;
}
