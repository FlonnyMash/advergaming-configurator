/**
 * Architectural contract: schema-first configuration for Studio & Configurator.
 *
 * - `GameMasterConfig` = `meta` + `system` (studio) + `branding` (client-safe)
 * - Legacy flat shape (`theme` / `gameplay` / `domOverlay`) supported via `migrateLegacyConfig`
 */

import {
  LegacyGameMasterConfigSchema,
  type AnimationClipMapping,
  type AnimationDefinition,
  type AppMode,
  type BrandingPatch,
  type BrandingSettings,
  type ConfigRootCategory,
  type ControlFieldSchema,
  type ControlSurface,
  type ControlType,
  type ControlValue,
  type GameMasterConfig,
  type GameMasterConfigMeta,
  type GameSchema,
  type GameTemplateId,
  type LegacyGameMasterConfig,
  type RewardRuleConfig,
  type SpriteSheetDefinition,
  type SystemSettings,
  type WinConditionConfig,
} from "./game-schema";

export type {
  AnimationClipMapping,
  AnimationDefinition,
  AppMode,
  BrandingPatch,
  BrandingSettings,
  ConfigRootCategory,
  ControlFieldSchema,
  ControlSurface,
  ControlType,
  ControlValue,
  GameMasterConfig,
  GameMasterConfigMeta,
  GameSchema,
  GameTemplateId,
  LegacyGameMasterConfig,
  RewardRuleConfig,
  SpriteSheetDefinition,
  SystemSettings,
  WinConditionConfig,
};

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const GAME_TEMPLATE_IDS = ["dice-poker", "clicker", "demo-starter"] as const;
export type BuiltinGameTemplateId = (typeof GAME_TEMPLATE_IDS)[number];

export const DEFAULT_GAME_TEMPLATE_ID: GameTemplateId = "dice-poker";
export const DEFAULT_SCHEMA_VERSION = "1.0.0";

export function isGameTemplateId(
  value: string,
  knownIds?: readonly string[],
): value is GameTemplateId {
  if (knownIds) return knownIds.includes(value);
  return value.length > 0;
}

export function parseGameTemplateId(
  value: string | null | undefined,
  knownIds?: readonly string[],
): GameTemplateId {
  if (value && isGameTemplateId(value, knownIds)) return value;
  return DEFAULT_GAME_TEMPLATE_ID;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface PublishedTemplateBundle {
  manifest: import("./template-manifest").TemplateManifest;
  systemDefaults: SystemSettings;
  brandingSchema: GameSchema;
}

// ---------------------------------------------------------------------------
// Legacy flat config (migration)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `branding.theme`
 * `playerTexture` is a persisted plain string; coerce at runtime via `coerceAssetReference`.
 */
export interface ThemeConfig {
  primaryColor: string;
  playerTexture: string | null;
}

/** @deprecated Use `system.mechanics` */
export interface GameplayConfig {
  playerSpeed: number;
}

/** @deprecated Use `branding.domOverlay` */
export interface DOMOverlayConfig {
  startScreenTitle: string;
  showLeadForm: boolean;
  ctaButtonText: string;
  showHighscores: boolean;
}

export function isLegacyGameMasterConfig(
  data: unknown,
): data is LegacyGameMasterConfig {
  return LegacyGameMasterConfigSchema.safeParse(data).success;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  physics: { gravity: { x: 0, y: 0 }, debugDraw: false },
  mechanics: {
    playerSpeed: 200,
    winCondition: { type: "score", targetScore: 1000 },
    rewardRules: { pointsPerAction: 10 },
  },
  assets: { registry: {}, spriteSheets: [] },
  animations: [],
};

export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  theme: {
    primaryColor: "#6366f1",
    secondaryColor: "#818cf8",
    logoTexture: null,
    fontFamily: "system-ui, sans-serif",
    playerTexture: null,
  },
  localization: { defaultLocale: "en", strings: {} },
  domOverlay: {
    startScreenTitle: "Play Now",
    showLeadForm: false,
    ctaButtonText: "Start Game",
    showHighscores: true,
  },
  gamification: {
    leaderboardEndpoint: null,
    rewardParameters: {},
  },
  animationOverrides: [],
};

export const DEFAULT_GAME_MASTER_CONFIG: GameMasterConfig = {
  meta: {
    templateId: DEFAULT_GAME_TEMPLATE_ID,
    schemaVersion: DEFAULT_SCHEMA_VERSION,
  },
  system: structuredClone(DEFAULT_SYSTEM_SETTINGS),
  branding: structuredClone(DEFAULT_BRANDING_SETTINGS),
};

// ---------------------------------------------------------------------------
// Schema-first UI metadata aliases
// ---------------------------------------------------------------------------

/** @deprecated Use `ControlFieldSchema` */
export type ControlSchema = ControlFieldSchema;

/** @deprecated Use `ConfigRootCategory` */
export type ConfigCategory = ConfigRootCategory;

// ---------------------------------------------------------------------------
// Config accessors for scenes / DOM overlay
// ---------------------------------------------------------------------------

export function getPrimaryBrandColor(config: GameMasterConfig): string {
  return config.branding.theme.primaryColor;
}

export function getDomOverlayForUi(config: GameMasterConfig): {
  startScreenTitle: string;
  showLeadForm: boolean;
  ctaButtonText: string;
  showHighscores: boolean;
  primaryColor: string;
} {
  return {
    ...config.branding.domOverlay,
    primaryColor: config.branding.theme.primaryColor,
  };
}
