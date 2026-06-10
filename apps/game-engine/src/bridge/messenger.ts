import {
  BRIDGE_MESSAGE_TYPE,
  BridgeMessageSchema,
  ConfigSyncPayloadSchema,
  GameConfigSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
  type AssetLoadErrorPayload,
  type EngineControlAction,
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
  getCurrentConfig: () => GameConfig;
  getCurrentTemplateId: () => GameTemplateId;
  getGame: () => Phaser.Game | null;
  onLoadTemplate?: (templateId: string) => void;
};

let currentTemplateId: GameTemplateId = "default";

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
    if (event.source !== window.parent) return;
    if (!isAllowedDashboardOrigin(event.origin)) {
      return;
    }

    const parsedMessage = BridgeMessageSchema.safeParse(event.data);
    if (!parsedMessage.success) {
      return;
    }
    const message = parsedMessage.data;

    const handlers = this.handlers;
    if (!handlers) return;

    switch (message.type) {
      case BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG: {
        const parsed = GameConfigSchema.safeParse(message.payload);
        if (!parsed.success) {
          return;
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
        if (handlers.onLoadTemplate) {
          handlers.onLoadTemplate(message.payload);
        } else {
          this.sendEngineReady();
        }
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
      case BRIDGE_MESSAGE_TYPE.CONFIG_UPDATED: {
        const parsed = ConfigSyncPayloadSchema.safeParse(message.payload);
        if (!parsed.success) break;
        let nextConfig: GameConfig;
        if (parsed.data.mode === "full") {
          nextConfig = parsed.data.config;
        } else {
          const merged = { ...handlers.getCurrentConfig(), ...parsed.data.fields };
          const validated = GameConfigSchema.safeParse(merged);
          if (!validated.success) break;
          nextConfig = validated.data;
        }
        this.notifyConfigUpdate(nextConfig);
        const game = handlers.getGame();
        if (game) {
          game.events.emit("bridge:config-update", nextConfig);
        }
        break;
      }
      case BRIDGE_MESSAGE_TYPE.ENGINE_CONTROL: {
        this.handleEngineControl(message.payload.action);
        break;
      }
      default:
        break;
    }
  }

  private handleEngineControl(action: EngineControlAction): void {
    // Broadcast as a DOM CustomEvent so any non-Phaser listener can react.
    window.dispatchEvent(new CustomEvent("engine:control", { detail: { action } }));

    // START_GAME is re-broadcast as a dedicated local event INSIDE the iframe.
    // Template scenes (e.g. CatchGameScene) subscribe via
    // `window.addEventListener("ENGINE_START_GAME", ...)` to unpause and run.
    if (action === "START_GAME") {
      window.dispatchEvent(new CustomEvent("ENGINE_START_GAME"));
    }

    // Also route through the Phaser game event bus so scenes can listen with
    // `this.game.events.on("bridge:control", handler)` without coupling to DOM.
    const game = this.handlers?.getGame();
    if (game) {
      game.events.emit("bridge:control", action);
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
