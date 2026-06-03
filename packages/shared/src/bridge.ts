import { normalizeGameMasterConfig } from "./config-utils";
import {
  BRIDGE_MESSAGE_TYPE,
  BridgeMessageSchema,
  BrandingPatchSchema,
  DiagnosticsPayloadMessageSchema,
  GameEventMessageSchema,
  IframeReadyMessageSchema,
  isBrandingPatchShape,
  LoadTemplateMessageSchema,
  RequestDiagnosticsMessageSchema,
  UpdateConfigMessageSchema,
  type BrandingPatch,
  type BridgeMessage,
  type DiagnosticsPayloadMessage,
  type GameEventMessage,
  type GameMasterConfig,
  type IframeReadyMessage,
  type LoadTemplateMessage,
  type RequestDiagnosticsMessage,
  type UpdateConfigMessage,
} from "./game-schema";

export { BRIDGE_MESSAGE_TYPE };
export type {
  AssetReadyMessage,
  BridgeMessage,
  ConfigUpdateMode,
  DiagnosticsPayloadMessage,
  GameEventMessage,
  IframeReadyMessage,
  LoadExternalAssetMessage,
  LoadTemplateMessage,
  RequestDiagnosticsMessage,
  SetRuntimeAssetsMessage,
  UpdateConfigMessage,
} from "./game-schema";

export {
  AssetReadyPayloadSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
  type AssetReadyPayload,
  type LoadExternalAssetPayload,
  type SetRuntimeAssetsPayload,
} from "./asset-bridge";

export function isGameMasterConfig(data: unknown): data is GameMasterConfig {
  return normalizeGameMasterConfig(data) !== null;
}

export function isBrandingPatch(data: unknown): data is BrandingPatch {
  return BrandingPatchSchema.safeParse(data).success;
}

export function isIframeReadyMessage(data: unknown): data is IframeReadyMessage {
  return IframeReadyMessageSchema.safeParse(data).success;
}

export function isUpdateConfigMessage(
  data: unknown,
): data is UpdateConfigMessage {
  return UpdateConfigMessageSchema.safeParse(data).success;
}

export function isLoadTemplateMessage(
  data: unknown,
): data is LoadTemplateMessage {
  const result = LoadTemplateMessageSchema.safeParse(data);
  if (!result.success) return false;
  return /^[\w-]+$/.test(result.data.payload);
}

export function isRequestDiagnosticsMessage(
  data: unknown,
): data is RequestDiagnosticsMessage {
  return RequestDiagnosticsMessageSchema.safeParse(data).success;
}

export function isDiagnosticsPayloadMessage(
  data: unknown,
): data is DiagnosticsPayloadMessage {
  return DiagnosticsPayloadMessageSchema.safeParse(data).success;
}

export function isGameEventMessage(data: unknown): data is GameEventMessage {
  return GameEventMessageSchema.safeParse(data).success;
}

export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  const result = BridgeMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export { isBrandingPatchShape };
export {
  isHitboxUpdatedMessage,
  parseHitboxUpdatedMessage,
  type HitboxUpdatedMessage,
  type HitboxUpdatePayload,
} from "./editor-bridge";
