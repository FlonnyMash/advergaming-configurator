import {
  BRIDGE_MESSAGE_TYPE,
  GAME_CHROME_BRIDGE_EVENTS,
  parseSetGameChromeOverlayVisibilityPayload,
  type GameChromeOverlayDescriptor,
} from "@mashedgames/shared";
import { getEngineMode } from "../env/app-mode.ts";
import {
  getParentTargetOrigin,
  isAllowedDashboardOrigin,
} from "./dashboard-origin.ts";

export type GameChromeOverlayRegistration = {
  id: string;
  label: string;
  element: HTMLElement;
};

type RegisteredOverlay = GameChromeOverlayRegistration & {
  available: boolean;
  userVisible: boolean;
};

function isPreviewMode(): boolean {
  const mode = getEngineMode();
  return mode === "studio" || mode === "configurator";
}

export type GameChromeOverlayHandle = {
  setAvailable: (available: boolean) => void;
  unregister: () => void;
};

class GameChromeOverlayManager {
  private overlays = new Map<string, RegisteredOverlay>();
  private bridgeEnabled = false;
  private teardownBridge: (() => void) | null = null;

  register(registration: GameChromeOverlayRegistration): GameChromeOverlayHandle {
    const { id, label, element } = registration;

    element.dataset.gameChromeOverlay = id;
    element.classList.add("game-chrome-overlay");

    const entry: RegisteredOverlay = {
      id,
      label,
      element,
      available: false,
      userVisible: true,
    };

    this.overlays.set(id, entry);
    this.syncElement(entry);
    this.postRegistry();

    return {
      setAvailable: (available: boolean) => {
        const overlay = this.overlays.get(id);
        if (!overlay) return;
        overlay.available = available;
        this.syncElement(overlay);
        this.postRegistry();
      },
      unregister: () => {
        const overlay = this.overlays.get(id);
        if (!overlay) return;
        overlay.element.classList.remove(
          "game-chrome-overlay",
          "game-chrome-overlay--user-hidden",
        );
        delete overlay.element.dataset.gameChromeOverlay;
        this.overlays.delete(id);
        this.postRegistry();
      },
    };
  }

  clear(): void {
    for (const overlay of this.overlays.values()) {
      overlay.element.classList.remove(
        "game-chrome-overlay",
        "game-chrome-overlay--user-hidden",
      );
      delete overlay.element.dataset.gameChromeOverlay;
    }
    this.overlays.clear();
    this.postRegistry();
  }

  setUserVisible(id: string, visible: boolean): void {
    const overlay = this.overlays.get(id);
    if (!overlay) return;
    overlay.userVisible = visible;
    this.syncElement(overlay);
    this.postRegistry();
  }

  enableBridge(): void {
    if (this.bridgeEnabled) return;
    this.bridgeEnabled = true;

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
      if (
        record.eventName !== GAME_CHROME_BRIDGE_EVENTS.SET_OVERLAY_VISIBILITY
      ) {
        return;
      }

      const payload = parseSetGameChromeOverlayVisibilityPayload(record.data);
      if (!payload) return;
      this.setUserVisible(payload.id, payload.visible);
    };

    window.addEventListener("message", onMessage);
    this.teardownBridge = () => {
      window.removeEventListener("message", onMessage);
      this.teardownBridge = null;
      this.bridgeEnabled = false;
    };

    this.postRegistry();
  }

  disableBridge(): void {
    this.teardownBridge?.();
  }

  private syncElement(overlay: RegisteredOverlay): void {
    const visible = overlay.available && overlay.userVisible;
    overlay.element.classList.toggle(
      "game-chrome-overlay--user-hidden",
      !visible,
    );
    overlay.element.setAttribute(
      "aria-hidden",
      visible ? "false" : "true",
    );
  }

  private buildRegistry(): GameChromeOverlayDescriptor[] {
    return [...this.overlays.values()].map((overlay) => ({
      id: overlay.id,
      label: overlay.label,
      available: overlay.available,
      userVisible: overlay.userVisible,
      visible: overlay.available && overlay.userVisible,
    }));
  }

  private postRegistry(): void {
    if (!this.bridgeEnabled || !isPreviewMode() || window.parent === window) {
      return;
    }

    window.parent.postMessage(
      {
        type: BRIDGE_MESSAGE_TYPE.GAME_EVENT,
        eventName: GAME_CHROME_BRIDGE_EVENTS.OVERLAYS_REGISTRY,
        data: { overlays: this.buildRegistry() },
      },
      getParentTargetOrigin(),
    );
  }
}

export const gameChromeOverlayManager = new GameChromeOverlayManager();

export function setupGameChromeBridge(): () => void {
  if (!isPreviewMode()) {
    return () => {};
  }

  gameChromeOverlayManager.enableBridge();
  return () => {
    gameChromeOverlayManager.disableBridge();
    gameChromeOverlayManager.clear();
  };
}
