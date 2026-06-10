import {
  BRIDGE_MESSAGE_TYPE,
  type GameLifecycleEventPayload,
} from "@mashedgames/shared";

/**
 * Dispatches a validated GAME_LIFECYCLE_EVENT message to the parent frame
 * (the dashboard overlay shell) via the postMessage bridge contract.
 *
 * Safe to call from any Phaser scene running inside the game-engine iframe.
 * No-ops when not embedded (window.parent === window).
 */
export function emitLifecycleEvent(payload: GameLifecycleEventPayload): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(
    { type: BRIDGE_MESSAGE_TYPE.GAME_LIFECYCLE_EVENT, payload },
    "*",
  );
}
