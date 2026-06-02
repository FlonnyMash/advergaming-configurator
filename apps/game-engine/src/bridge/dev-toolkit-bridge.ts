import {
  BRIDGE_MESSAGE_TYPE,
  DEV_TOOLKIT_BRIDGE_EVENTS,
  parseDevToolkitSetFlagsPayload,
  type DevToolkitFlags,
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

export function postDevToolkitState(state: DevToolkitFlags): void {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      type: BRIDGE_MESSAGE_TYPE.GAME_EVENT,
      eventName: DEV_TOOLKIT_BRIDGE_EVENTS.STATE,
      data: state,
    },
    getParentTargetOrigin(),
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
