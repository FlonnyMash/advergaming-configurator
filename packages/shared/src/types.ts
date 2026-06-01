/**
 * Architectural contract: schema-first configuration for Studio & Configurator.
 *
 * - `GameMasterConfig` = `meta` + `system` (studio) + `branding` (client-safe)
 * - Legacy flat shape (`theme` / `gameplay` / `domOverlay`) supported via `migrateLegacyConfig`
 */

// ---------------------------------------------------------------------------
// App mode
// ---------------------------------------------------------------------------

export type AppMode = "studio" | "configurator";

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const GAME_TEMPLATE_IDS = ["dice-poker", "clicker", "demo-starter"] as const;
export type BuiltinGameTemplateId = (typeof GAME_TEMPLATE_IDS)[number];

export type GameTemplateId = string;

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

// ---------------------------------------------------------------------------
// GameMasterConfig (split system / branding)
// ---------------------------------------------------------------------------

export interface GameMasterConfigMeta {
  templateId: GameTemplateId;
  schemaVersion: string;
}

export interface WinConditionConfig {
  type: "score" | "time" | "custom";
  targetScore?: number;
  maxDurationMs?: number;
}

export interface RewardRuleConfig {
  pointsPerAction: number;
  maxDailyRewards?: number;
}

export interface SpriteSheetDefinition {
  key: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  margin?: number;
  spacing?: number;
}

export interface AnimationDefinition {
  key: string;
  sheetKey: string;
  frames: number[] | { start: number; end: number };
  frameRate: number;
  repeat: number;
}

export interface SystemSettings {
  physics: {
    gravity: { x: number; y: number };
    debugDraw: boolean;
  };
  mechanics: {
    playerSpeed: number;
    winCondition: WinConditionConfig;
    rewardRules: RewardRuleConfig;
  };
  assets: {
    registry: Record<string, string>;
    spriteSheets: SpriteSheetDefinition[];
  };
  animations: AnimationDefinition[];
}

export interface AnimationClipMapping {
  animationKey: string;
  sheetKey: string;
  startFrame: number;
  endFrame: number;
  frameRate: number;
  loop: boolean;
}

export interface BrandingSettings {
  theme: {
    primaryColor: string;
    secondaryColor: string;
    logoTexture: string | null;
    fontFamily: string;
    playerTexture: string | null;
  };
  localization: {
    defaultLocale: string;
    strings: Record<string, Record<string, string>>;
  };
  domOverlay: {
    startScreenTitle: string;
    showLeadForm: boolean;
    ctaButtonText: string;
    showHighscores: boolean;
  };
  gamification: {
    leaderboardEndpoint: string | null;
    rewardParameters: Record<string, number | string | boolean>;
  };
  animationOverrides: AnimationClipMapping[];
}

export interface GameMasterConfig {
  meta: GameMasterConfigMeta;
  system: SystemSettings;
  branding: BrandingSettings;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type BrandingPatch = DeepPartial<BrandingSettings>;

export interface PublishedTemplateBundle {
  manifest: import("./template-manifest.js").TemplateManifest;
  systemDefaults: SystemSettings;
  brandingSchema: GameSchema;
}

// ---------------------------------------------------------------------------
// Legacy flat config (migration)
// ---------------------------------------------------------------------------

/** @deprecated Use `branding.theme` */
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

/** @deprecated Flat pre-split shape */
export interface LegacyGameMasterConfig {
  theme: ThemeConfig;
  gameplay: GameplayConfig;
  domOverlay: DOMOverlayConfig;
}

export function isLegacyGameMasterConfig(
  data: unknown,
): data is LegacyGameMasterConfig {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    "theme" in record &&
    "gameplay" in record &&
    "domOverlay" in record &&
    !("system" in record)
  );
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
// Schema-first UI metadata
// ---------------------------------------------------------------------------

export type ConfigRootCategory = "system" | "branding";

export type ControlSurface = "studio" | "configurator" | "both";

export type ControlType =
  | "slider"
  | "color"
  | "text"
  | "image"
  | "toggle";

export type ControlValue = string | number | boolean | null;

/**
 * `targetPath` is dot-separated within the root category, e.g. `theme.primaryColor`.
 */
export interface ControlFieldSchema {
  key: string;
  label: string;
  type: ControlType;
  targetCategory: ConfigRootCategory;
  targetPath: string;
  surface: ControlSurface;
  defaultValue: ControlValue;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface GameSchema {
  id: string;
  label: string;
  description?: string;
  controls: ControlFieldSchema[];
}

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
