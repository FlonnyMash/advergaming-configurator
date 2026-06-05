import {
  BRIDGE_MESSAGE_TYPE,
  BridgeMessageSchema,
  GameConfigSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
  type AssetLoadErrorPayload,
  type GameConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import { loadExternalAsset } from "./external-asset-loader.ts";
import { setRuntimeAssets } from "./runtime-assets.ts";
import type Phaser from "phaser";
import { getEngineMode } from "../env/app-mode.ts";
import {
  getParentTargetOrigin,
  isAllowedDashboardOrigin,
} from "./dashboard-origin.ts";

export type EngineBridgeHandlers = {
  onConfigUpdate: (config: GameConfig) => void;
  onLoadTemplate: (templateId: GameTemplateId) => void;
  getCurrentConfig: () => GameConfig;
  getCurrentTemplateId: () => GameTemplateId;
  getGame: () => Phaser.Game | null;
};

let currentTemplateId: GameTemplateId = "catch-game-demo";

export class EngineMessenger {
  private configListeners = new Set<(config: GameConfig) => void>();
  private handlers: EngineBridgeHandlers | null = null;
  private started = false;
  private boundListener: ((event: MessageEvent) => void) | null = null;

  start(handlers: EngineBridgeHandlers): void {
    if (this.started) return;
    this.started = true;
    this.handlers = handlers;
    currentTemplateId = handlers.getCurrentTemplateId();

    this.boundListener = (event: MessageEvent) => {
      this.handleMessage(event);
    };
    window.addEventListener("message", this.boundListener);
  }

  onConfigUpdate(listener: (config: GameConfig) => void): () => void {
    this.configListeners.add(listener);
    return () => {
      this.configListeners.delete(listener);
    };
  }

  sendEngineReady(): void {
    if (window.parent === window) return;

    const handlers = this.handlers;
    window.parent.postMessage(
      {
        type: BRIDGE_MESSAGE_TYPE.ENGINE_READY,
        payload: {
          activeTemplateId: handlers?.getCurrentTemplateId() ?? currentTemplateId,
          appMode: getEngineMode(),
        },
      },
      getParentTargetOrigin(),
    );
  }

  sendAssetLoadError(payload: AssetLoadErrorPayload): void {
    if (window.parent === window) return;

    window.parent.postMessage(
      {
        type: BRIDGE_MESSAGE_TYPE.ASSET_LOAD_ERROR,
        payload,
      },
      getParentTargetOrigin(),
    );
  }

  private notifyConfigUpdate(config: GameConfig): void {
    for (const listener of this.configListeners) {
      listener(config);
    }
    this.handlers?.onConfigUpdate(config);
  }

  private handleMessage(event: MessageEvent): void {
    if (import.meta.env.DEV) {
      console.log("[Engine Bridge] Received message:", event.data);
    }

    if (event.source !== window.parent) return;
    if (!isAllowedDashboardOrigin(event.origin)) {
      if (import.meta.env.DEV) {
        console.warn(
          "[Engine Bridge] Rejected origin:",
          event.origin,
          "(allowed dashboard origins only)",
        );
      }
      return;
    }

    const parsedMessage = BridgeMessageSchema.safeParse(event.data);
    if (!parsedMessage.success) {
      if (import.meta.env.DEV) {
        console.error(
          "[Engine Bridge] Zod Validation Failed:",
          parsedMessage.error,
        );
      }
      return;
    }
    const message = parsedMessage.data;

    const handlers = this.handlers;
    if (!handlers) return;

    switch (message.type) {
      case BRIDGE_MESSAGE_TYPE.CONFIG_UPDATED: {
        const parsed = GameConfigSchema.safeParse(message.payload);
        if (!parsed.success) {
          if (import.meta.env.DEV) {
            console.error(
              "[Engine Bridge] CONFIG_UPDATED payload rejected:",
              parsed.error,
            );
          }
          return;
        }
        if (import.meta.env.DEV) {
          console.log("[Engine Bridge] Applying CONFIG_UPDATED");
        }
        this.notifyConfigUpdate(parsed.data);
        const game = handlers.getGame();
        if (game) {
          game.events.emit("bridge:config-update", parsed.data);
        }
        break;
      }
      case BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE: {
        currentTemplateId = message.payload;
        handlers.onLoadTemplate(message.payload);
        this.sendEngineReady();
        break;
      }
      case BRIDGE_MESSAGE_TYPE.LOAD_EXTERNAL_ASSET: {
        const parsed = LoadExternalAssetPayloadSchema.safeParse(message.payload);
        if (!parsed.success) break;
        const game = handlers.getGame();
        if (!game) break;
        loadExternalAsset(
          game,
          parsed.data.key,
          parsed.data.absolutePath,
          handlers.getCurrentConfig().projectId,
        );
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
  }
}

export const engineMessenger = new EngineMessenger();

export function setupBridge(handlers: EngineBridgeHandlers): void {
  engineMessenger.start(handlers);
  engineMessenger.sendEngineReady();
}

export function setBridgeTemplateId(id: GameTemplateId): void {
  currentTemplateId = id;
}

import { HitboxUpdatePayloadSchema, type HitboxUpdatePayload } from "@mashedgames/shared";

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
