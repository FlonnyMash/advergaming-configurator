import { z } from "zod";

/** Game ↔ dashboard postMessage event names (GAME_EVENT.eventName). */
export const STUDIO_TOUCH_BRIDGE_EVENTS = {
  PLAYER_TOUCH: "playerTouch",
  TOUCH_CONTROLS_STATE: "touchControlsState",
} as const;

export const PlayerTouchBridgePayloadSchema = z.object({
  gameX: z.number(),
  active: z.boolean(),
});

export const TouchControlsStatePayloadSchema = z.object({
  visible: z.boolean(),
  gameWidth: z.number().positive(),
});

export type PlayerTouchBridgePayload = z.infer<
  typeof PlayerTouchBridgePayloadSchema
>;

export type TouchControlsStatePayload = z.infer<
  typeof TouchControlsStatePayloadSchema
>;

export function parsePlayerTouchBridgePayload(
  data: unknown,
): PlayerTouchBridgePayload | null {
  const result = PlayerTouchBridgePayloadSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseTouchControlsStatePayload(
  data: unknown,
): TouchControlsStatePayload | null {
  const result = TouchControlsStatePayloadSchema.safeParse(data);
  return result.success ? result.data : null;
}
