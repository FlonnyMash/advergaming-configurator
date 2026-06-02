import { z } from "zod";

/** Game ↔ dashboard postMessage event names (GAME_EVENT.eventName). */
export const DEV_TOOLKIT_BRIDGE_EVENTS = {
  SET_FLAGS: "devToolkitSetFlags",
  STATE: "devToolkitState",
} as const;

export const DevToolkitFlagsSchema = z.object({
  hitboxes: z.boolean(),
  origins: z.boolean(),
  pivots: z.boolean(),
  physicsDebug: z.boolean(),
  freeze: z.boolean(),
});

export const DevToolkitSetFlagsPayloadSchema = DevToolkitFlagsSchema.partial();

export type DevToolkitFlags = z.infer<typeof DevToolkitFlagsSchema>;
export type DevToolkitSetFlagsPayload = z.infer<
  typeof DevToolkitSetFlagsPayloadSchema
>;

export const DEFAULT_DEV_TOOLKIT_FLAGS: DevToolkitFlags = {
  hitboxes: false,
  origins: false,
  pivots: false,
  physicsDebug: false,
  freeze: false,
};

export function parseDevToolkitFlags(data: unknown): DevToolkitFlags | null {
  const result = DevToolkitFlagsSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseDevToolkitSetFlagsPayload(
  data: unknown,
): DevToolkitSetFlagsPayload | null {
  const result = DevToolkitSetFlagsPayloadSchema.safeParse(data);
  return result.success ? result.data : null;
}
