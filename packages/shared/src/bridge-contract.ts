import { z } from "zod";
import {
  AssetReadyPayloadSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
} from "./asset-bridge";
import { AppModeSchema, GameConfigSchema, type GameConfig } from "./flat-game-config";

export const BRIDGE_MESSAGE_TYPE = {
  UPDATE_CONFIG: "UPDATE_CONFIG",
  ENGINE_READY: "ENGINE_READY",
  LOAD_TEMPLATE: "LOAD_TEMPLATE",
  LOAD_EXTERNAL_ASSET: "LOAD_EXTERNAL_ASSET",
  ASSET_READY: "ASSET_READY",
  ASSET_LOAD_ERROR: "ASSET_LOAD_ERROR",
  SET_RUNTIME_ASSETS: "SET_RUNTIME_ASSETS",
  GAME_EVENT: "GAME_EVENT",
  CONFIG_UPDATED: "CONFIG_UPDATED",
} as const;

export type BridgeMessageType =
  (typeof BRIDGE_MESSAGE_TYPE)[keyof typeof BRIDGE_MESSAGE_TYPE];

export const UpdateConfigMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG),
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
    key: z.string().optional(),
    message: z.string(),
  }),
});

export const LoadTemplateMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE),
  payload: z.string().min(1),
});

export const GameEventMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.GAME_EVENT),
  event: z.string().min(1),
  data: z.unknown().optional(),
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

/**
 * Structured real-time config sync payload.
 * "full" replaces the engine's entire config state in-place.
 * "delta" merges only the changed fields into the current state.
 * sequenceId allows the engine to discard out-of-order messages.
 */
export const ConfigSyncPayloadSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("full"),
    config: GameConfigSchema,
    projectId: z.string().min(1),
    sequenceId: z.number().int().nonnegative(),
    timestamp: z.number(),
  }),
  z.object({
    mode: z.literal("delta"),
    fields: GameConfigSchema.partial(),
    projectId: z.string().min(1),
    sequenceId: z.number().int().nonnegative(),
    timestamp: z.number(),
  }),
]);

export const ConfigUpdatedMessageSchema = z.object({
  type: z.literal(BRIDGE_MESSAGE_TYPE.CONFIG_UPDATED),
  payload: ConfigSyncPayloadSchema,
});

export const BridgeMessageSchema = z.discriminatedUnion("type", [
  UpdateConfigMessageSchema,
  EngineReadyMessageSchema,
  AssetLoadErrorMessageSchema,
  LoadTemplateMessageSchema,
  GameEventMessageSchema,
  LoadExternalAssetMessageSchema,
  AssetReadyMessageSchema,
  SetRuntimeAssetsMessageSchema,
  ConfigUpdatedMessageSchema,
]);

export type UpdateConfigMessage = z.infer<typeof UpdateConfigMessageSchema>;
export type EngineReadyMessage = z.infer<typeof EngineReadyMessageSchema>;
export type AssetLoadErrorMessage = z.infer<typeof AssetLoadErrorMessageSchema>;
export type AssetLoadErrorPayload = AssetLoadErrorMessage["payload"];
export type LoadTemplateMessage = z.infer<typeof LoadTemplateMessageSchema>;
export type GameEventMessage = z.infer<typeof GameEventMessageSchema>;
export type LoadExternalAssetMessage = z.infer<
  typeof LoadExternalAssetMessageSchema
>;
export type AssetReadyMessage = z.infer<typeof AssetReadyMessageSchema>;
export type SetRuntimeAssetsMessage = z.infer<
  typeof SetRuntimeAssetsMessageSchema
>;
export type ConfigSyncPayload = z.infer<typeof ConfigSyncPayloadSchema>;
export type ConfigUpdatedMessage = z.infer<typeof ConfigUpdatedMessageSchema>;
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;

export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  const result = BridgeMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function isUpdateConfigMessage(
  message: BridgeMessage,
): message is UpdateConfigMessage {
  return message.type === BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG;
}

export function isEngineReadyMessage(
  message: BridgeMessage,
): message is EngineReadyMessage {
  return message.type === BRIDGE_MESSAGE_TYPE.ENGINE_READY;
}

export function isLoadTemplateMessage(
  message: BridgeMessage,
): message is LoadTemplateMessage {
  return message.type === BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE;
}

export function isGameEventMessage(
  message: BridgeMessage,
): message is GameEventMessage {
  return message.type === BRIDGE_MESSAGE_TYPE.GAME_EVENT;
}

export function isAssetLoadErrorMessage(
  message: BridgeMessage,
): message is AssetLoadErrorMessage {
  return message.type === BRIDGE_MESSAGE_TYPE.ASSET_LOAD_ERROR;
}

export function isConfigUpdatedMessage(
  message: BridgeMessage,
): message is ConfigUpdatedMessage {
  return message.type === BRIDGE_MESSAGE_TYPE.CONFIG_UPDATED;
}

export type { GameConfig };
