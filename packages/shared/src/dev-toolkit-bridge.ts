import { z } from "zod";

/** Game ↔ dashboard postMessage event names (GAME_EVENT.eventName). */
export const DEV_TOOLKIT_BRIDGE_EVENTS = {
  SET_FLAGS: "devToolkitSetFlags",
  STATE: "devToolkitState",
  ASSET_PICKED: "devToolkitAssetPicked",
} as const;

export const DevToolkitFlagsSchema = z.object({
  hitboxes: z.boolean(),
  origins: z.boolean(),
  pivots: z.boolean(),
  physicsDebug: z.boolean(),
  freeze: z.boolean(),
  assetPicker: z.boolean(),
});

export const DevToolkitHitboxLayoutSchema = z.object({
  width: z.number().min(0).max(2).optional(),
  height: z.number().min(0).max(2).optional(),
  offsetX: z.number().min(-1).max(2).optional(),
  offsetY: z.number().min(-1).max(2).optional(),
});

export const DevToolkitVec2LayoutSchema = z.object({
  x: z.number().min(-2).max(2).optional(),
  y: z.number().min(-2).max(2).optional(),
});

export const DevToolkitAssetLayoutSchema = z.object({
  hitbox: DevToolkitHitboxLayoutSchema.optional(),
  centerOffset: DevToolkitVec2LayoutSchema.optional(),
  rotationAnchor: DevToolkitVec2LayoutSchema.optional(),
  origin: DevToolkitVec2LayoutSchema.optional(),
});

export const DevToolkitAssetConfigBindingSchema = z.object({
  scope: z.enum(["branding", "system"]),
  itemKind: z.enum(["goodItem", "badItem", "playerSprite"]),
  itemIndex: z.number().int().min(0).optional(),
});

export type DevToolkitAssetLayout = z.infer<typeof DevToolkitAssetLayoutSchema>;
export type DevToolkitAssetConfigBinding = z.infer<
  typeof DevToolkitAssetConfigBindingSchema
>;

export const DevToolkitPickedAssetSchema = z.object({
  sceneKey: z.string(),
  objectType: z.string(),
  name: z.string().optional(),
  textureKey: z.string().optional(),
  frameName: z.union([z.string(), z.number()]).optional(),
  x: z.number(),
  y: z.number(),
  displayWidth: z.number(),
  displayHeight: z.number(),
  sourceWidth: z.number().optional(),
  sourceHeight: z.number().optional(),
  scaleX: z.number(),
  scaleY: z.number(),
  previewDataUrl: z.string().optional(),
  layout: DevToolkitAssetLayoutSchema.optional(),
  configBinding: DevToolkitAssetConfigBindingSchema.optional(),
});

export type DevToolkitPickedAsset = z.infer<typeof DevToolkitPickedAssetSchema>;

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
  assetPicker: false,
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

const MAX_PREVIEW_DATA_URL_LENGTH = 1_500_000;

function finiteInRange(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(max, Math.max(min, value));
}

function sanitizeLayoutValue(
  layout: z.infer<typeof DevToolkitAssetLayoutSchema>,
): z.infer<typeof DevToolkitAssetLayoutSchema> {
  const hitbox = layout.hitbox
    ? {
        width: finiteInRange(layout.hitbox.width, 0, 2),
        height: finiteInRange(layout.hitbox.height, 0, 2),
        offsetX: finiteInRange(layout.hitbox.offsetX, -1, 2),
        offsetY: finiteInRange(layout.hitbox.offsetY, -1, 2),
      }
    : undefined;

  const centerOffset = layout.centerOffset
    ? {
        x: finiteInRange(layout.centerOffset.x, -2, 2),
        y: finiteInRange(layout.centerOffset.y, -2, 2),
      }
    : undefined;

  const rotationAnchor = layout.rotationAnchor
    ? {
        x: finiteInRange(layout.rotationAnchor.x, 0, 1),
        y: finiteInRange(layout.rotationAnchor.y, 0, 1),
      }
    : undefined;

  const origin = layout.origin
    ? {
        x: finiteInRange(layout.origin.x, 0, 1),
        y: finiteInRange(layout.origin.y, 0, 1),
      }
    : undefined;

  return {
    hitbox,
    centerOffset,
    rotationAnchor,
    origin,
  };
}

/** Normalizes engine payloads so postMessage + zod validation stay reliable. */
export function sanitizeDevToolkitPickedAsset(
  data: unknown,
): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  const record = { ...(data as Record<string, unknown>) };

  for (const key of [
    "x",
    "y",
    "scaleX",
    "scaleY",
    "displayWidth",
    "displayHeight",
    "sourceWidth",
    "sourceHeight",
  ] as const) {
    const value = record[key];
    if (typeof value === "number" && !Number.isFinite(value)) {
      delete record[key];
    }
  }

  if (
    typeof record.previewDataUrl === "string" &&
    record.previewDataUrl.length > MAX_PREVIEW_DATA_URL_LENGTH
  ) {
    delete record.previewDataUrl;
  }

  if (typeof record.layout === "object" && record.layout !== null) {
    const layoutResult = DevToolkitAssetLayoutSchema.safeParse(record.layout);
    if (layoutResult.success) {
      record.layout = sanitizeLayoutValue(layoutResult.data);
    } else {
      delete record.layout;
    }
  }

  return record;
}

export function parseDevToolkitPickedAsset(
  data: unknown,
): DevToolkitPickedAsset | null {
  const result = DevToolkitPickedAssetSchema.safeParse(
    sanitizeDevToolkitPickedAsset(data),
  );
  return result.success ? result.data : null;
}
