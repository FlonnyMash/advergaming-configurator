import { z } from "zod";
import { NullableAssetStringSchema } from "./asset-reference";
import {
  AssetReadyPayloadSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
} from "./asset-bridge";
import { HitboxUpdatedMessageSchema } from "./editor-bridge";
import {
  AppModeSchema,
  CatchableItemSchema,
  GameTemplateIdSchema,
  HazardItemSchema,
  PlayerEntitySchema,
  type CatchableItem,
  type HazardItem,
  type PlayerEntity,
} from "./game-schema";

// ---------------------------------------------------------------------------
// Flat game config (AI-friendly, top-level keys)
// ---------------------------------------------------------------------------

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color");

export const GameConfigSchema = z
  .object({
    activeTemplateId: z.string().min(1),
    themeColor: hexColorSchema.optional(),
    logoUrl: NullableAssetStringSchema.optional(),
    difficultyLevel: z.enum(["easy", "medium", "hard"]).optional(),
    projectId: z.string().optional(),
    schemaVersion: z.string().optional(),
    parentTemplateId: z.string().optional(),
    parentPinnedVersion: z.string().optional(),
    lastParentSyncAt: z.string().optional(),
    appMode: AppModeSchema.optional(),
    catchableItems: z.array(CatchableItemSchema).optional(),
    hazardItems: z.array(HazardItemSchema).optional(),
    playerEntity: PlayerEntitySchema.optional(),
  })
  .passthrough();

export type GameConfig = z.infer<typeof GameConfigSchema>;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  activeTemplateId: "catch-game-demo",
  themeColor: "#6366f1",
  schemaVersion: "1.0.0",
};

export const DEFAULT_CATCHABLE_ITEMS: CatchableItem[] = [
  {
    id: "default-good",
    assetUrl: "",
    scoreValue: 10,
    dropSpeed: 200,
    spawnWeight: 1,
  },
];

export const DEFAULT_HAZARD_ITEMS: HazardItem[] = [
  {
    id: "default-hazard",
    assetUrl: "",
    scoreValue: -5,
    dropSpeed: 280,
    spawnWeight: 1,
  },
];

export const DEFAULT_PLAYER_ENTITY: PlayerEntity = {
  assetUrl: "",
  speed: 320,
};

export function resolveCatchGameEntities(config: GameConfig): {
  catchableItems: CatchableItem[];
  hazardItems: HazardItem[];
  playerEntity: PlayerEntity;
} {
  return {
    catchableItems:
      config.catchableItems && config.catchableItems.length > 0
        ? config.catchableItems
        : DEFAULT_CATCHABLE_ITEMS,
    hazardItems:
      config.hazardItems && config.hazardItems.length > 0
        ? config.hazardItems
        : DEFAULT_HAZARD_ITEMS,
    playerEntity: config.playerEntity ?? DEFAULT_PLAYER_ENTITY,
  };
}

// ---------------------------------------------------------------------------
// Bridge message types
// ---------------------------------------------------------------------------

export const BRIDGE_MESSAGE_TYPE = {
  CONFIG_UPDATED: "CONFIG_UPDATED",
  ENGINE_READY: "ENGINE_READY",
  ASSET_LOAD_ERROR: "ASSET_LOAD_ERROR",
  LOAD_TEMPLATE: "LOAD_TEMPLATE",
  SET_RUNTIME_ASSETS: "SET_RUNTIME_ASSETS",
  LOAD_EXTERNAL_ASSET: "LOAD_EXTERNAL_ASSET",
  ASSET_READY: "ASSET_READY",
  HITBOX_UPDATED: "HITBOX_UPDATED",
  GAME_EVENT: "GAME_EVENT",
} as const;

export const ConfigUpdatedMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.CONFIG_UPDATED),
  payload: GameConfigSchema,
});

export const EngineReadyMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.ENGINE_READY),
  payload: z.object({
    activeTemplateId: z.string().min(1),
    appMode: AppModeSchema.optional(),
  }),
});

export const AssetLoadErrorMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.ASSET_LOAD_ERROR),
  payload: z.object({
    key: z.string().min(1),
    message: z.string().min(1),
    source: z.string().optional(),
  }),
});

export const LoadTemplateMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE),
  payload: GameTemplateIdSchema,
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
  ConfigUpdatedMessageSchema,
  EngineReadyMessageSchema,
  AssetLoadErrorMessageSchema,
  LoadTemplateMessageSchema,
  SetRuntimeAssetsMessageSchema,
  LoadExternalAssetMessageSchema,
  AssetReadyMessageSchema,
  HitboxUpdatedMessageSchema,
  GameEventMessageSchema,
]);

export type ConfigUpdatedMessage = z.infer<typeof ConfigUpdatedMessageSchema>;
export type EngineReadyMessage = z.infer<typeof EngineReadyMessageSchema>;
export type AssetLoadErrorMessage = z.infer<typeof AssetLoadErrorMessageSchema>;
export type LoadTemplateMessage = z.infer<typeof LoadTemplateMessageSchema>;
export type GameEventMessage = z.infer<typeof GameEventMessageSchema>;
export type LoadExternalAssetMessage = z.infer<
  typeof LoadExternalAssetMessageSchema
>;
export type AssetReadyMessage = z.infer<typeof AssetReadyMessageSchema>;
export type SetRuntimeAssetsMessage = z.infer<
  typeof SetRuntimeAssetsMessageSchema
>;
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;
export type AssetLoadErrorPayload = AssetLoadErrorMessage["payload"];

export function parseGameConfig(data: unknown): GameConfig | null {
  const result = GameConfigSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  const result = BridgeMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function isEngineReadyMessage(data: unknown): data is EngineReadyMessage {
  return EngineReadyMessageSchema.safeParse(data).success;
}

export function isConfigUpdatedMessage(
  data: unknown,
): data is ConfigUpdatedMessage {
  return ConfigUpdatedMessageSchema.safeParse(data).success;
}

export function isLoadTemplateMessage(
  data: unknown,
): data is LoadTemplateMessage {
  const result = LoadTemplateMessageSchema.safeParse(data);
  if (!result.success) return false;
  return /^[\w-]+$/.test(result.data.payload);
}

export function isGameEventMessage(data: unknown): data is GameEventMessage {
  return GameEventMessageSchema.safeParse(data).success;
}

export function isAssetLoadErrorMessage(
  data: unknown,
): data is AssetLoadErrorMessage {
  return AssetLoadErrorMessageSchema.safeParse(data).success;
}
