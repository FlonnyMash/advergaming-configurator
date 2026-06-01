import {
  BRIDGE_MESSAGE_TYPE,
  isUpdateConfigMessage,
  type GameMasterConfig,
  type IframeReadyMessage,
} from "@advergaming/shared";

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
    return origin === DEFAULT_DASHBOARD_ORIGIN || origin === "http://127.0.0.1:3000";
  }
  return origin === DEFAULT_DASHBOARD_ORIGIN;
}

export function setupBridge(onUpdate: (config: GameMasterConfig) => void): void {
  const iframeReadyMessage: IframeReadyMessage = {
    type: BRIDGE_MESSAGE_TYPE.IFRAME_READY,
  };
  // Prefer referrer origin so the parent receives the handshake; fall back to * in standalone dev.
  window.parent.postMessage(iframeReadyMessage, getParentTargetOrigin());

  window.addEventListener("message", (event: MessageEvent) => {
    if (!isAllowedDashboardOrigin(event.origin)) return;
    if (!isUpdateConfigMessage(event.data)) return;
    onUpdate(event.data.payload);
  });
}
