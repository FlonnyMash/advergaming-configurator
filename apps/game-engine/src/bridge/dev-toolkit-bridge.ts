import {
  BRIDGE_MESSAGE_TYPE,
  DEV_TOOLKIT_BRIDGE_EVENTS,
  parseDevToolkitSetFlagsPayload,
  sanitizeDevToolkitPickedAsset,
  type DevToolkitFlags,
  type DevToolkitPickedAsset,
} from "@advergaming/shared";
import type { DevToolkitController } from "../debug/dev-toolkit/DevToolkitController.ts";

const DEFAULT_DASHBOARD_ORIGIN = "http://localhost:3000";

function getDashboardOrigin(): string | undefined {
  const envOrigin = import.meta.env.VITE_DASHBOARD_ORIGIN;
  if (typeof envOrigin === "string" && envOrigin.length > 0) {
    return envOrigin;
  }
  return undefined;
}

function getParentTargetOrigin(): string {
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      // fall through
    }
  }
  return getDashboardOrigin() ?? "*";
}

function isAllowedDashboardOrigin(origin: string): boolean {
  const configured = getDashboardOrigin();
  if (configured) return origin === configured;
  if (import.meta.env.DEV) {
    return (
      origin === DEFAULT_DASHBOARD_ORIGIN ||
      origin === "http://127.0.0.1:3000"
    );
  }
  return origin === DEFAULT_DASHBOARD_ORIGIN;
}

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
