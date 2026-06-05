/**
 * Architectural contract: schema-first configuration for Studio & Configurator.
 * Runtime and bridge use flat `GameConfig` (see game-config-bridge.ts).
 */

import type {
  AnimationClipMapping,
  AnimationDefinition,
  AppMode,
  ConfigRootCategory,
  ControlFieldSchema,
  ControlSurface,
  ControlType,
  ControlValue,
  GameSchema,
  GameTemplateId,
  RewardRuleConfig,
  SpriteSheetDefinition,
  SystemSettings,
  WinConditionConfig,
} from "./game-schema";
import { DEFAULT_GAME_CONFIG } from "./game-config-bridge";
import type { GameConfig } from "./game-config-bridge";

export type {
  AnimationClipMapping,
  AnimationDefinition,
  AppMode,
  ConfigRootCategory,
  ControlFieldSchema,
  ControlSurface,
  ControlType,
  ControlValue,
  GameConfig,
  GameSchema,
  GameTemplateId,
  RewardRuleConfig,
  SpriteSheetDefinition,
  SystemSettings,
  WinConditionConfig,
};

export { DEFAULT_GAME_CONFIG };

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const GAME_TEMPLATE_IDS = ["catch-game-demo"] as const;
export type BuiltinGameTemplateId = (typeof GAME_TEMPLATE_IDS)[number];

export const DEFAULT_GAME_TEMPLATE_ID: GameTemplateId = "catch-game-demo";
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
  systemDefaults: Record<string, unknown>;
  brandingSchema: GameSchema;
}

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

export {
  getDomOverlayForUi,
  getPrimaryBrandColor,
} from "./config-flatten";
