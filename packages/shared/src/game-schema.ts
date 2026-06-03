import { z } from "zod";
import { NullableAssetStringSchema } from "./asset-reference";
import {
  AssetReadyPayloadSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
} from "./asset-bridge";
import {
  BridgePayloadSchema,
  HitboxUpdatedMessageSchema,
} from "./editor-bridge";

// ---------------------------------------------------------------------------
// Bridge message type constants
// ---------------------------------------------------------------------------

export const BRIDGE_MESSAGE_TYPE = {
  UPDATE_CONFIG: "UPDATE_CONFIG",
  IFRAME_READY: "IFRAME_READY",
  LOAD_TEMPLATE: "LOAD_TEMPLATE",
  REQUEST_DIAGNOSTICS: "REQUEST_DIAGNOSTICS",
  DIAGNOSTICS_PAYLOAD: "DIAGNOSTICS_PAYLOAD",
  GAME_EVENT: "GAME_EVENT",
  HITBOX_UPDATED: "HITBOX_UPDATED",
  LOAD_EXTERNAL_ASSET: "LOAD_EXTERNAL_ASSET",
  ASSET_READY: "ASSET_READY",
  SET_RUNTIME_ASSETS: "SET_RUNTIME_ASSETS",
} as const;

// ---------------------------------------------------------------------------
// App mode & template ids
// ---------------------------------------------------------------------------

export const AppModeSchema = z.enum(["studio", "configurator"]);
export type AppMode = z.infer<typeof AppModeSchema>;

export const ConfigUpdateModeSchema = z.enum(["full", "branding-patch"]);
export type ConfigUpdateMode = z.infer<typeof ConfigUpdateModeSchema>;

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
// GameMasterConfig tree
// ---------------------------------------------------------------------------

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");

export const GameMasterConfigMetaSchema = z.object({
  templateId: GameTemplateIdSchema,
  schemaVersion: z.string(),
  projectId: z.string().optional(),
  parentTemplateId: GameTemplateIdSchema.optional(),
  parentPinnedVersion: z.string().optional(),
  lastParentSyncAt: z.string().optional(),
});

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

export const SystemSettingsSchema = z
  .object({
    physics: z.object({
      gravity: z.object({ x: z.number(), y: z.number() }),
      debugDraw: z.boolean(),
    }),
    mechanics: z.object({
      playerSpeed: z.number(),
      winCondition: WinConditionConfigSchema,
      rewardRules: RewardRuleConfigSchema,
    }),
    assets: z.object({
      registry: z.record(z.string(), z.string()),
      spriteSheets: z.array(SpriteSheetDefinitionSchema),
    }),
    animations: z.array(AnimationDefinitionSchema),
  })
  .passthrough();

export const AnimationClipMappingSchema = z.object({
  animationKey: z.string(),
  sheetKey: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
  frameRate: z.number(),
  loop: z.boolean(),
});

export const BrandingSettingsSchema = z
  .object({
    theme: z.object({
      primaryColor: hexColorSchema,
      secondaryColor: hexColorSchema,
      logoTexture: NullableAssetStringSchema,
      fontFamily: z.string(),
      playerTexture: NullableAssetStringSchema,
    }),
    localization: z.object({
      defaultLocale: z.string(),
      strings: z.record(z.string(), z.record(z.string(), z.string())),
    }),
    domOverlay: z.object({
      startScreenTitle: z.string(),
      showLeadForm: z.boolean(),
      ctaButtonText: z.string(),
      showHighscores: z.boolean(),
    }),
    gamification: z.object({
      leaderboardEndpoint: z.string().nullable(),
      rewardParameters: z.record(
        z.union([z.number(), z.string(), z.boolean()]),
      ),
    }),
    animationOverrides: z.array(AnimationClipMappingSchema),
  })
  .passthrough();

export const GameMasterConfigSchema = z.object({
  meta: GameMasterConfigMetaSchema,
  system: SystemSettingsSchema,
  branding: BrandingSettingsSchema,
});

export const BrandingPatchSchema = z
  .object({
    theme: z
      .object({
        primaryColor: hexColorSchema.optional(),
        secondaryColor: hexColorSchema.optional(),
        logoTexture: NullableAssetStringSchema.optional(),
        fontFamily: z.string().optional(),
        playerTexture: NullableAssetStringSchema.optional(),
      })
      .optional(),
    localization: z
      .object({
        defaultLocale: z.string().optional(),
        strings: z.record(z.record(z.string())).optional(),
      })
      .optional(),
    domOverlay: z
      .object({
        startScreenTitle: z.string().optional(),
        showLeadForm: z.boolean().optional(),
        ctaButtonText: z.string().optional(),
        showHighscores: z.boolean().optional(),
      })
      .optional(),
    gamification: z
      .object({
        leaderboardEndpoint: z.string().nullable().optional(),
        rewardParameters: z
          .record(z.union([z.number(), z.string(), z.boolean()]))
          .optional(),
      })
      .optional(),
    animationOverrides: z.array(AnimationClipMappingSchema).optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Legacy flat config (migration)
// ---------------------------------------------------------------------------

export const LegacyGameMasterConfigSchema = z.object({
  theme: z.object({
    primaryColor: z.string(),
    playerTexture: z.string().nullable(),
  }),
  gameplay: z.object({
    playerSpeed: z.number(),
  }),
  domOverlay: z.object({
    startScreenTitle: z.string(),
    showLeadForm: z.boolean(),
    ctaButtonText: z.string(),
    showHighscores: z.boolean(),
  }),
});

// ---------------------------------------------------------------------------
// Bridge messages
// ---------------------------------------------------------------------------

const IframeReadyCapabilitiesSchema = z.object({
  engineMode: AppModeSchema,
  allowsSystemMutation: z.boolean(),
  templateId: GameTemplateIdSchema,
  /** Studio preview: touch bar rendered outside the iframe (e.g. under device mockup). */
  externalTouchControls: z.boolean().optional(),
});

export const IframeReadyMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.IFRAME_READY),
  capabilities: IframeReadyCapabilitiesSchema,
});

export const UpdateConfigMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG),
  payload: z.union([
    BridgePayloadSchema,
    GameMasterConfigSchema,
    BrandingPatchSchema,
  ]),
  updateMode: ConfigUpdateModeSchema,
  senderMode: AppModeSchema,
});

export const LoadTemplateMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE),
  payload: GameTemplateIdSchema,
});

export const RequestDiagnosticsMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.REQUEST_DIAGNOSTICS),
});

export const DiagnosticsPayloadMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.DIAGNOSTICS_PAYLOAD),
  payload: z.object({
    config: GameMasterConfigSchema,
    templateId: GameTemplateIdSchema,
    engineMode: AppModeSchema,
  }),
});

export const GameEventMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.GAME_EVENT),
  eventName: z.string(),
  data: z.unknown(),
});

export const LoadExternalAssetMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.LOAD_EXTERNAL_ASSET),
  payload: LoadExternalAssetPayloadSchema,
});

export const AssetReadyMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.ASSET_READY),
  payload: AssetReadyPayloadSchema,
});

export const SetRuntimeAssetsMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.SET_RUNTIME_ASSETS),
  payload: SetRuntimeAssetsPayloadSchema,
});

export const BridgeMessageSchema = z.discriminatedUnion("type", [
  IframeReadyMessageSchema,
  UpdateConfigMessageSchema,
  LoadTemplateMessageSchema,
  RequestDiagnosticsMessageSchema,
  DiagnosticsPayloadMessageSchema,
  GameEventMessageSchema,
  HitboxUpdatedMessageSchema,
  LoadExternalAssetMessageSchema,
  AssetReadyMessageSchema,
  SetRuntimeAssetsMessageSchema,
]);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ConfigRootCategory = z.infer<typeof ConfigRootCategorySchema>;
export type ControlSurface = z.infer<typeof ControlSurfaceSchema>;
export type ControlType = z.infer<typeof ControlTypeSchema>;
export type ControlValue = z.infer<typeof ControlValueSchema>;
export type ControlFieldSchema = z.infer<typeof ControlFieldSchemaSchema>;
export type GameSchema = z.infer<typeof GameSchemaSchema>;
export type GameMasterConfigMeta = z.infer<typeof GameMasterConfigMetaSchema>;
export type WinConditionConfig = z.infer<typeof WinConditionConfigSchema>;
export type RewardRuleConfig = z.infer<typeof RewardRuleConfigSchema>;
export type SpriteSheetDefinition = z.infer<typeof SpriteSheetDefinitionSchema>;
export type AnimationDefinition = z.infer<typeof AnimationDefinitionSchema>;
export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
export type AnimationClipMapping = z.infer<typeof AnimationClipMappingSchema>;
export type BrandingSettings = z.infer<typeof BrandingSettingsSchema>;
export type GameMasterConfig = z.infer<typeof GameMasterConfigSchema>;
export type BrandingPatch = z.infer<typeof BrandingPatchSchema>;
export type LegacyGameMasterConfig = z.infer<typeof LegacyGameMasterConfigSchema>;

export type IframeReadyMessage = z.infer<typeof IframeReadyMessageSchema>;
export type UpdateConfigMessage = z.infer<typeof UpdateConfigMessageSchema>;
export type LoadTemplateMessage = z.infer<typeof LoadTemplateMessageSchema>;
export type RequestDiagnosticsMessage = z.infer<
  typeof RequestDiagnosticsMessageSchema
>;
export type DiagnosticsPayloadMessage = z.infer<
  typeof DiagnosticsPayloadMessageSchema
>;
export type GameEventMessage = z.infer<typeof GameEventMessageSchema>;
export type LoadExternalAssetMessage = z.infer<
  typeof LoadExternalAssetMessageSchema
>;
export type AssetReadyMessage = z.infer<typeof AssetReadyMessageSchema>;
export type SetRuntimeAssetsMessage = z.infer<
  typeof SetRuntimeAssetsMessageSchema
>;
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

export function parseGameMasterConfig(data: unknown): GameMasterConfig | null {
  const result = GameMasterConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseBrandingPatch(data: unknown): BrandingPatch | null {
  const result = BrandingPatchSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  const result = BridgeMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function isBrandingPatchShape(data: unknown): data is BrandingPatch {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return !("system" in record) && !("meta" in record);
}
