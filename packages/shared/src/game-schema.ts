import { z } from "zod";

// ---------------------------------------------------------------------------
// App mode & template ids
// ---------------------------------------------------------------------------

export const AppModeSchema = z.enum(["studio", "configurator"]);
export type AppMode = z.infer<typeof AppModeSchema>;

export const GameTemplateIdSchema = z.string().min(1);
export type GameTemplateId = z.infer<typeof GameTemplateIdSchema>;

// ---------------------------------------------------------------------------
// Schema-first UI metadata
// ---------------------------------------------------------------------------

export const ConfigRootCategorySchema = z.enum(["system", "branding"]);
export const ControlSurfaceSchema = z.enum(["studio", "configurator", "both"]);
export const ControlTypeSchema = z.enum([
  "slider",
  "color",
  "text",
  "image",
  "toggle",
]);

export const ControlValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const ControlFieldSchemaSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: ControlTypeSchema,
  targetCategory: ConfigRootCategorySchema,
  targetPath: z.string(),
  surface: ControlSurfaceSchema,
  defaultValue: ControlValueSchema,
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  placeholder: z.string().optional(),
});

export const GameSchemaSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  controls: z.array(ControlFieldSchemaSchema),
});

// ---------------------------------------------------------------------------
// Shared structural types (used in manifests / tooling)
// ---------------------------------------------------------------------------

export const WinConditionConfigSchema = z.object({
  type: z.enum(["score", "time", "custom"]),
  targetScore: z.number().optional(),
  maxDurationMs: z.number().optional(),
});

export const RewardRuleConfigSchema = z.object({
  pointsPerAction: z.number(),
  maxDailyRewards: z.number().optional(),
});

export const SpriteSheetDefinitionSchema = z.object({
  key: z.string(),
  frameWidth: z.number(),
  frameHeight: z.number(),
  frameCount: z.number(),
  margin: z.number().optional(),
  spacing: z.number().optional(),
});

export const AnimationDefinitionSchema = z.object({
  key: z.string(),
  sheetKey: z.string(),
  frames: z.union([
    z.array(z.number()),
    z.object({ start: z.number(), end: z.number() }),
  ]),
  frameRate: z.number(),
  repeat: z.number(),
});

export const AnimationClipMappingSchema = z.object({
  animationKey: z.string(),
  sheetKey: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
  frameRate: z.number(),
  loop: z.boolean(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ConfigRootCategory = z.infer<typeof ConfigRootCategorySchema>;
export type ControlSurface = z.infer<typeof ControlSurfaceSchema>;
export type ControlType = z.infer<typeof ControlTypeSchema>;
export type ControlValue = z.infer<typeof ControlValueSchema>;
export type ControlFieldSchema = z.infer<typeof ControlFieldSchemaSchema>;
export type GameSchema = z.infer<typeof GameSchemaSchema>;
export type WinConditionConfig = z.infer<typeof WinConditionConfigSchema>;
export type RewardRuleConfig = z.infer<typeof RewardRuleConfigSchema>;
export type SpriteSheetDefinition = z.infer<typeof SpriteSheetDefinitionSchema>;
export type AnimationDefinition = z.infer<typeof AnimationDefinitionSchema>;
export type AnimationClipMapping = z.infer<typeof AnimationClipMappingSchema>;

/** Frozen template system defaults (published-system.json shape). */
export type SystemSettings = Record<string, unknown>;
