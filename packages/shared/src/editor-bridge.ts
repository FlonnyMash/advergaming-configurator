import { z } from "zod";

const WorkspaceModeSchema = z.enum(["studio", "configurator"]);

export const EditorStateSchema = z.object({
  workspaceMode: WorkspaceModeSchema,
  isAssetInspectorActive: z.boolean(),
  activeEntityId: z.string().nullable(),
});

export const HitboxUpdatePayloadSchema = z.object({
  entityId: z.string().min(1),
  width: z.number().min(0).max(2),
  height: z.number().min(0).max(2),
  offsetX: z.number().min(-1).max(2),
  offsetY: z.number().min(-1).max(2),
});

export const HitboxUpdatedMessageSchema = z.object({
  type: z.literal("HITBOX_UPDATED"),
  payload: HitboxUpdatePayloadSchema,
});

export type EditorState = z.infer<typeof EditorStateSchema>;
export type HitboxUpdatePayload = z.infer<typeof HitboxUpdatePayloadSchema>;
export type HitboxUpdatedMessage = z.infer<typeof HitboxUpdatedMessageSchema>;

export const DEFAULT_EDITOR_STATE: EditorState = {
  workspaceMode: "studio",
  isAssetInspectorActive: false,
  activeEntityId: null,
};

/** Stable id for config-bound sprites: scope:itemKind:index */
export function encodeEntityId(input: {
  scope: "branding" | "system";
  itemKind: "goodItem" | "badItem" | "playerSprite";
  itemIndex?: number;
}): string {
  return `${input.scope}:${input.itemKind}:${input.itemIndex ?? 0}`;
}

export function parseEntityId(
  entityId: string,
): {
  scope: "branding" | "system";
  itemKind: "goodItem" | "badItem" | "playerSprite";
  itemIndex: number;
} | null {
  const parts = entityId.split(":");
  if (parts.length !== 3) return null;
  const [scope, itemKind, indexRaw] = parts;
  if (scope !== "branding" && scope !== "system") return null;
  if (
    itemKind !== "goodItem" &&
    itemKind !== "badItem" &&
    itemKind !== "playerSprite"
  ) {
    return null;
  }
  const itemIndex = Number(indexRaw);
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return null;
  return { scope, itemKind, itemIndex };
}

export function parseHitboxUpdatedMessage(
  data: unknown,
): HitboxUpdatedMessage | null {
  const result = HitboxUpdatedMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function isHitboxUpdatedMessage(
  data: unknown,
): data is HitboxUpdatedMessage {
  return parseHitboxUpdatedMessage(data) !== null;
}

/** Deep clone using JSON so postMessage never sees functions or live store refs. */
export function cloneForBridgePostMessage<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
