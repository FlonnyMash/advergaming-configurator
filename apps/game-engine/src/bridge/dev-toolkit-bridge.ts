import {
  BRIDGE_MESSAGE_TYPE,
  DEV_TOOLKIT_BRIDGE_EVENTS,
  parseDevToolkitSetFlagsPayload,
  sanitizeDevToolkitPickedAsset,
  type DevToolkitFlags,
  type DevToolkitPickedAsset,
} from "@mashedgames/shared";
import type { DevToolkitController } from "../debug/dev-toolkit/DevToolkitController.ts";
import {
  getParentTargetOrigin,
  isAllowedDashboardOrigin,
} from "./dashboard-origin.ts";

function postDevToolkitGameEvent(eventName: string, data: unknown): void {
  if (window.parent === window) {
    return;
  }

  const message = {
    type: BRIDGE_MESSAGE_TYPE.GAME_EVENT,
    eventName,
    data,
  };

  try {
    window.parent.postMessage(message, getParentTargetOrigin());
    return;
  } catch (error) {
    if (eventName !== DEV_TOOLKIT_BRIDGE_EVENTS.ASSET_PICKED) {
      throw error;
    }
  }

  const slim = sanitizeDevToolkitPickedAsset(data) as DevToolkitPickedAsset;
  if (slim && typeof slim === "object") {
    const fallback = { ...slim };
    delete (fallback as { previewDataUrl?: string }).previewDataUrl;
    window.parent.postMessage(
      { ...message, data: fallback },
      getParentTargetOrigin(),
    );
  }
}

export function postDevToolkitState(state: DevToolkitFlags): void {
  postDevToolkitGameEvent(DEV_TOOLKIT_BRIDGE_EVENTS.STATE, state);
}

export function postDevToolkitAssetPicked(asset: DevToolkitPickedAsset): void {
  postDevToolkitGameEvent(
    DEV_TOOLKIT_BRIDGE_EVENTS.ASSET_PICKED,
    sanitizeDevToolkitPickedAsset(asset),
  );
}

export function setupDevToolkitBridge(
  getController: () => DevToolkitController | null,
): () => void {
  if (window.parent === window) {
    return () => undefined;
  }

  const onMessage = (event: MessageEvent): void => {
    if (!isAllowedDashboardOrigin(event.origin)) return;

    const data = event.data;
    if (
      typeof data !== "object" ||
      data === null ||
      (data as { type?: string }).type !== BRIDGE_MESSAGE_TYPE.GAME_EVENT
    ) {
      return;
    }

    const record = data as { eventName?: string; data?: unknown };
    if (record.eventName !== DEV_TOOLKIT_BRIDGE_EVENTS.SET_FLAGS) {
      return;
    }

    const payload = parseDevToolkitSetFlagsPayload(record.data);
    if (!payload) return;

    getController()?.applyFlags(payload);
  };

  window.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("message", onMessage);
  };
}
