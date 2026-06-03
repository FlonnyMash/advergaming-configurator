import {
  BRIDGE_MESSAGE_TYPE,
  EditorStateSchema,
  HitboxUpdatePayloadSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
  coerceUpdateConfigPayload,
  parseBridgeMessage,
  type EditorState,
  type GameMasterConfig,
  type GameTemplateId,
  type HitboxUpdatePayload,
  type IframeReadyMessage,
  type UpdateConfigMessage,
} from "@advergaming/shared";
import { loadExternalAsset } from "./external-asset-loader.ts";
import { setRuntimeAssets } from "./runtime-assets.ts";
import type Phaser from "phaser";
import { supportsExternalTouchControls } from "./studio-touch-bridge.ts";
import { allowsSystemMutation, getEngineMode } from "../env/app-mode.ts";
import { applyBrandingPatch } from "../configurator/applyBrandingOnly.ts";
import { getPublishedSystemDefaults } from "../templates/schema-index.ts";
import {
  getParentTargetOrigin,
  isAllowedDashboardOrigin,
} from "./dashboard-origin.ts";

let currentTemplateId: GameTemplateId = "dice-poker";

function resolveGameConfig(
  message: UpdateConfigMessage,
  bridgePayload: { gameConfig: GameMasterConfig; editorState: EditorState },
  previous: GameMasterConfig,
): GameMasterConfig {
  const engineMode = getEngineMode();

  if (message.updateMode === "branding-patch") {
    return applyBrandingPatch(previous, bridgePayload.gameConfig.branding);
  }

  const normalized = bridgePayload.gameConfig;
  if (engineMode === "configurator" || message.senderMode === "configurator") {
    const frozen = getPublishedSystemDefaults(currentTemplateId);
    return {
      meta: { ...normalized.meta, templateId: currentTemplateId },
      system: structuredClone(frozen),
      branding: structuredClone(normalized.branding),
    };
  }

  return normalized;
}

export function setupBridge(handlers: {
  onUpdate: (config: GameMasterConfig) => void;
  onEditorState: (state: EditorState) => void;
  onLoadTemplate: (templateId: GameTemplateId) => void;
  getCurrentConfig: () => GameMasterConfig;
  getCurrentTemplateId: () => GameTemplateId;
  getGame: () => Phaser.Game | null;
}): void {
  const postReady = () => {
    const iframeReadyMessage: IframeReadyMessage = {
      type: BRIDGE_MESSAGE_TYPE.IFRAME_READY,
      capabilities: {
        engineMode: getEngineMode(),
        allowsSystemMutation: allowsSystemMutation(),
        templateId: handlers.getCurrentTemplateId(),
        externalTouchControls: supportsExternalTouchControls(
          handlers.getCurrentTemplateId(),
        ),
      },
    };
    window.parent.postMessage(iframeReadyMessage, getParentTargetOrigin());
  };

  postReady();

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    if (!isAllowedDashboardOrigin(event.origin)) return;

    const message = parseBridgeMessage(event.data);
    if (!message) {
      if (import.meta.env.DEV) {
        console.warn("Engine received invalid message format:", event.data);
      }
      return;
    }

    switch (message.type) {
      case BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG: {
        const previous = handlers.getCurrentConfig();
        const bridgePayload = coerceUpdateConfigPayload(
          message.payload,
          currentTemplateId,
          previous,
        );
        if (!bridgePayload) {
          break;
        }

        const editorParse = EditorStateSchema.safeParse(bridgePayload.editorState);
        const editorState = editorParse.success
          ? editorParse.data
          : bridgePayload.editorState;

        const resolvedConfig = resolveGameConfig(message, bridgePayload, previous);
        handlers.onUpdate(resolvedConfig);
        handlers.onEditorState(editorState);

        const game = handlers.getGame();
        if (game) {
          game.events.emit("bridge:editor-state", editorState);
          game.events.emit("bridge:config-update", resolvedConfig);
        }
        break;
      }
      case BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE: {
        currentTemplateId = message.payload;
        handlers.onLoadTemplate(message.payload);
        postReady();
        break;
      }
      case BRIDGE_MESSAGE_TYPE.REQUEST_DIAGNOSTICS: {
        const config = handlers.getCurrentConfig();
        window.parent.postMessage(
          {
            type: BRIDGE_MESSAGE_TYPE.DIAGNOSTICS_PAYLOAD,
            payload: {
              config,
              templateId: handlers.getCurrentTemplateId(),
              engineMode: getEngineMode(),
            },
          },
          event.origin,
        );
        break;
      }
      case BRIDGE_MESSAGE_TYPE.LOAD_EXTERNAL_ASSET: {
        const parsed = LoadExternalAssetPayloadSchema.safeParse(message.payload);
        if (!parsed.success) break;
        const game = handlers.getGame();
        if (!game) break;
        loadExternalAsset(game, parsed.data.key, parsed.data.absolutePath);
        break;
      }
      case BRIDGE_MESSAGE_TYPE.SET_RUNTIME_ASSETS: {
        const parsed = SetRuntimeAssetsPayloadSchema.safeParse(message.payload);
        if (!parsed.success) break;
        setRuntimeAssets(parsed.data.assets);
        break;
      }
      default:
        break;
    }
  });
}

export function postHitboxUpdated(payload: HitboxUpdatePayload): void {
  if (window.parent === window) {
    return;
  }

  const parsed = HitboxUpdatePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    if (import.meta.env.DEV) {
      console.warn("[HitboxEditor] Invalid HITBOX_UPDATED payload", payload);
    }
    return;
  }

  window.parent.postMessage(
    {
      type: BRIDGE_MESSAGE_TYPE.HITBOX_UPDATED,
      payload: parsed.data,
    },
    getParentTargetOrigin(),
  );
}

export function setBridgeTemplateId(id: GameTemplateId): void {
  currentTemplateId = id;
}
