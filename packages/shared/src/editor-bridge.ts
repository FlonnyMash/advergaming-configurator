import { z } from "zod";
import { mergeBrandingPatch, normalizeGameMasterConfig } from "./config-utils";
import {
  isBrandingPatchShape,
  type BrandingPatch,
  type GameMasterConfig,
  type GameTemplateId,
} from "./game-schema";
import { DEFAULT_GAME_MASTER_CONFIG } from "./types";

const WorkspaceModeSchema = z.enum(["studio", "configurator"]);

export const EditorStateSchema = z.object({
  workspaceMode: WorkspaceModeSchema,
  isAssetInspectorActive: z.boolean(),
  activeEntityId: z.string().nullable(),
});

function lazyGameMasterConfigSchema(): z.ZodType<GameMasterConfig> {
  const { GameMasterConfigSchema } =
    require("./game-schema") as typeof import("./game-schema");
  return GameMasterConfigSchema;
}

export const BridgePayloadSchema = z.object({
  editorState: EditorStateSchema,
  gameConfig: z.lazy(lazyGameMasterConfigSchema),
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
export type BridgePayload = z.infer<typeof BridgePayloadSchema>;
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

export function parseBridgePayload(data: unknown): BridgePayload | null {
  const result = BridgePayloadSchema.safeParse(data);
  return result.success ? result.data : null;
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

export function isBridgePayloadShape(data: unknown): data is BridgePayload {
  return parseBridgePayload(data) !== null;
}

export function coerceUpdateConfigPayload(
  payload: unknown,
  templateId: GameTemplateId,
  previousConfig: GameMasterConfig,
): BridgePayload | null {
  const bridgePayload = parseBridgePayload(payload);
  if (bridgePayload) {
    return bridgePayload;
  }

  if (isBrandingPatchShape(payload)) {
    return {
      editorState: DEFAULT_EDITOR_STATE,
      gameConfig: mergeBrandingPatch(previousConfig, payload as BrandingPatch),
    };
  }

  const normalized = normalizeGameMasterConfig(payload, templateId);
  if (!normalized) {
    return null;
  }

  return {
    editorState: DEFAULT_EDITOR_STATE,
    gameConfig: normalized,
  };
}

export function buildBridgePayload(
  editorState: EditorState,
  gameConfig: GameMasterConfig,
  appMode: EditorState["workspaceMode"],
): BridgePayload {
  const sanitizedEditorState: EditorState =
    appMode === "configurator"
      ? {
          workspaceMode: "configurator",
          isAssetInspectorActive: false,
          activeEntityId: null,
        }
      : { ...editorState, workspaceMode: appMode };

  return {
    editorState: sanitizedEditorState,
    gameConfig,
  };
}

export function defaultBridgePayload(
  templateId: GameTemplateId = DEFAULT_GAME_MASTER_CONFIG.meta.templateId,
): BridgePayload {
  return {
    editorState: DEFAULT_EDITOR_STATE,
    gameConfig: {
      ...DEFAULT_GAME_MASTER_CONFIG,
      meta: { ...DEFAULT_GAME_MASTER_CONFIG.meta, templateId },
    },
  };
}
