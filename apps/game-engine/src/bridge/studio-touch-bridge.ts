import {
  BRIDGE_MESSAGE_TYPE,
  STUDIO_TOUCH_BRIDGE_EVENTS,
  parsePlayerTouchBridgePayload,
  type GameTemplateId,
} from "@advergaming/shared";
import type Phaser from "phaser";
import { getEngineMode } from "../env/app-mode.ts";
import {
  getParentTargetOrigin,
  isAllowedDashboardOrigin,
} from "./dashboard-origin.ts";

const PLAYER_TOUCH_EVENT = STUDIO_TOUCH_BRIDGE_EVENTS.PLAYER_TOUCH;

function isPreviewMode(): boolean {
  const mode = getEngineMode();
  return mode === "studio" || mode === "configurator";
}

export function supportsExternalTouchControls(_templateId: GameTemplateId): boolean {
  return false;
}

export function postTouchControlsState(visible: boolean, gameWidth: number): void {
  if (!isPreviewMode() || window.parent === window || gameWidth <= 0) {
    return;
  }

  window.parent.postMessage(
    {
      type: BRIDGE_MESSAGE_TYPE.GAME_EVENT,
      eventName: STUDIO_TOUCH_BRIDGE_EVENTS.TOUCH_CONTROLS_STATE,
      data: { visible, gameWidth },
    },
    getParentTargetOrigin(),
  );
}

export function setupStudioTouchBridge(game: Phaser.Game): () => void {
  if (!isPreviewMode() || window.parent === window) {
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
    if (record.eventName !== STUDIO_TOUCH_BRIDGE_EVENTS.PLAYER_TOUCH) {
      return;
    }

    const payload = parsePlayerTouchBridgePayload(record.data);
    if (!payload) return;
    game.events.emit(PLAYER_TOUCH_EVENT, payload);
  };

  window.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("message", onMessage);
  };
}
