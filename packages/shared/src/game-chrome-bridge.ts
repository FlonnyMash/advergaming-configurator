import { z } from "zod";

/** Game ↔ dashboard postMessage event names for in-game chrome overlays. */
export const GAME_CHROME_BRIDGE_EVENTS = {
  OVERLAYS_REGISTRY: "gameChromeOverlaysRegistry",
  SET_OVERLAY_VISIBILITY: "setGameChromeOverlayVisibility",
} as const;

export const GameChromeOverlayDescriptorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Overlay is eligible to show (e.g. only during gameplay). */
  available: z.boolean(),
  /** User preference from the dashboard toggle. */
  userVisible: z.boolean(),
  /** Effective visibility after user toggle + availability. */
  visible: z.boolean(),
});

export const GameChromeOverlaysRegistryPayloadSchema = z.object({
  overlays: z.array(GameChromeOverlayDescriptorSchema),
});

export const SetGameChromeOverlayVisibilityPayloadSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
});

export type GameChromeOverlayDescriptor = z.infer<
  typeof GameChromeOverlayDescriptorSchema
>;

export type GameChromeOverlaysRegistryPayload = z.infer<
  typeof GameChromeOverlaysRegistryPayloadSchema
>;

export type SetGameChromeOverlayVisibilityPayload = z.infer<
  typeof SetGameChromeOverlayVisibilityPayloadSchema
>;

export function parseGameChromeOverlaysRegistryPayload(
  data: unknown,
): GameChromeOverlaysRegistryPayload | null {
  const result = GameChromeOverlaysRegistryPayloadSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseSetGameChromeOverlayVisibilityPayload(
  data: unknown,
): SetGameChromeOverlayVisibilityPayload | null {
  const result = SetGameChromeOverlayVisibilityPayloadSchema.safeParse(data);
  return result.success ? result.data : null;
}
