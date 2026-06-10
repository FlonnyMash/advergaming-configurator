import { z } from "zod";
import { NullableAssetStringSchema } from "./asset-reference";

export const AppModeSchema = z.enum(["studio", "configurator"]);
export type AppMode = z.infer<typeof AppModeSchema>;

export const DEFAULT_SCHEMA_VERSION = "2.0.0";
export const DEFAULT_GAME_TEMPLATE_ID = "default";

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");

export const GameConfigSchema = z.object({
  activeTemplateId: z.string().min(1),
  projectId: z.string().optional(),
  schemaVersion: z.string(),
  appMode: AppModeSchema.optional(),
  themeColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  logoUrl: NullableAssetStringSchema.optional(),
  startScreenTitle: z.string(),
  startScreenSubtitle: z.string().optional(),
  ctaLabel: z.string(),
  playerSpeed: z.number().min(0),
  gameDurationSeconds: z.number().min(1),
  parentTemplateId: z.string().optional(),
  parentPinnedVersion: z.string().optional(),
  lastParentSyncAt: z.string().optional(),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type GameTemplateId = string;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  activeTemplateId: DEFAULT_GAME_TEMPLATE_ID,
  schemaVersion: DEFAULT_SCHEMA_VERSION,
  themeColor: "#6366f1",
  backgroundColor: "#0f172a",
  startScreenTitle: "Ready to play?",
  startScreenSubtitle: "Tap start when you are ready.",
  ctaLabel: "Start Game",
  playerSpeed: 320,
  gameDurationSeconds: 60,
};

export function parseGameConfig(data: unknown): GameConfig {
  return GameConfigSchema.parse(data);
}

export function normalizeGameConfig(
  data: unknown,
  fallback: GameConfig = DEFAULT_GAME_CONFIG,
): GameConfig {
  const result = GameConfigSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return { ...fallback };
}

export function patchFlatConfig<K extends keyof GameConfig>(
  config: GameConfig,
  key: K,
  value: GameConfig[K],
): GameConfig {
  return { ...config, [key]: value };
}

export function patchConfig(
  config: GameConfig,
  partial: Partial<GameConfig>,
): GameConfig {
  return { ...config, ...partial };
}

export function getPrimaryBrandColor(config: GameConfig): string {
  return config.themeColor;
}

export function exportClientPayload(config: GameConfig): GameConfig {
  return GameConfigSchema.parse(config);
}
