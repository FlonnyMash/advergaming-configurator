import { normalizeGameMasterConfig } from "./config-utils";
import type {
  AppMode,
  BrandingPatch,
  GameMasterConfig,
  GameTemplateId,
} from "./types";

export const BRIDGE_MESSAGE_TYPE = {
  UPDATE_CONFIG: "UPDATE_CONFIG",
  IFRAME_READY: "IFRAME_READY",
  LOAD_TEMPLATE: "LOAD_TEMPLATE",
  REQUEST_DIAGNOSTICS: "REQUEST_DIAGNOSTICS",
  DIAGNOSTICS_PAYLOAD: "DIAGNOSTICS_PAYLOAD",
} as const;

export type ConfigUpdateMode = "full" | "branding-patch";

export interface IframeReadyMessage {
  type: typeof BRIDGE_MESSAGE_TYPE.IFRAME_READY;
  capabilities: {
    engineMode: AppMode;
    allowsSystemMutation: boolean;
    templateId: GameTemplateId;
  };
}

export interface UpdateConfigMessage {
  type: typeof BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG;
  payload: GameMasterConfig | BrandingPatch;
  updateMode: ConfigUpdateMode;
  senderMode: AppMode;
}

export interface LoadTemplateMessage {
  type: typeof BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE;
  payload: GameTemplateId;
}

export interface RequestDiagnosticsMessage {
  type: typeof BRIDGE_MESSAGE_TYPE.REQUEST_DIAGNOSTICS;
}

export interface DiagnosticsPayloadMessage {
  type: typeof BRIDGE_MESSAGE_TYPE.DIAGNOSTICS_PAYLOAD;
  payload: {
    config: GameMasterConfig;
    templateId: GameTemplateId;
    engineMode: AppMode;
  };
}

export type BridgeMessage =
  | UpdateConfigMessage
  | IframeReadyMessage
  | LoadTemplateMessage
  | RequestDiagnosticsMessage
  | DiagnosticsPayloadMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAppMode(value: unknown): value is AppMode {
  return value === "studio" || value === "configurator";
}

export function isGameMasterConfig(data: unknown): data is GameMasterConfig {
  return normalizeGameMasterConfig(data) !== null;
}

export function isBrandingPatch(data: unknown): data is BrandingPatch {
  if (!isRecord(data)) return false;
  return !("system" in data) && !("meta" in data);
}

export function isIframeReadyMessage(data: unknown): data is IframeReadyMessage {
  if (!isRecord(data) || data.type !== BRIDGE_MESSAGE_TYPE.IFRAME_READY) {
    return false;
  }
  const capabilities = data.capabilities;
  if (!isRecord(capabilities)) return false;
  return (
    isAppMode(capabilities.engineMode) &&
    typeof capabilities.allowsSystemMutation === "boolean" &&
    typeof capabilities.templateId === "string"
  );
}

export function isUpdateConfigMessage(
  data: unknown,
): data is UpdateConfigMessage {
  if (!isRecord(data) || data.type !== BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG) {
    return false;
  }
  if (data.updateMode !== "full" && data.updateMode !== "branding-patch") {
    return false;
  }
  if (!isAppMode(data.senderMode)) return false;

  if (data.updateMode === "full") {
    return isGameMasterConfig(data.payload);
  }
  return isBrandingPatch(data.payload) || isGameMasterConfig(data.payload);
}

export function isLoadTemplateMessage(
  data: unknown,
): data is LoadTemplateMessage {
  return (
    isRecord(data) &&
    data.type === BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE &&
    typeof data.payload === "string" &&
    data.payload.length > 0 &&
    /^[\w-]+$/.test(data.payload)
  );
}

export function isRequestDiagnosticsMessage(
  data: unknown,
): data is RequestDiagnosticsMessage {
  return (
    isRecord(data) &&
    data.type === BRIDGE_MESSAGE_TYPE.REQUEST_DIAGNOSTICS
  );
}

export function isDiagnosticsPayloadMessage(
  data: unknown,
): data is DiagnosticsPayloadMessage {
  if (!isRecord(data) || data.type !== BRIDGE_MESSAGE_TYPE.DIAGNOSTICS_PAYLOAD) {
    return false;
  }
  const payload = data.payload;
  if (!isRecord(payload)) return false;
  return (
    isGameMasterConfig(payload.config) &&
    typeof payload.templateId === "string" &&
    isAppMode(payload.engineMode)
  );
}
