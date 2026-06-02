import {
  BRIDGE_MESSAGE_TYPE,
  normalizeGameMasterConfig,
  parseBridgeMessage,
  type BrandingPatch,
  type GameMasterConfig,
  type GameTemplateId,
  type IframeReadyMessage,
  type UpdateConfigMessage,
} from "@advergaming/shared";
import { supportsExternalTouchControls } from "./studio-touch-bridge.ts";
import { allowsSystemMutation, getEngineMode } from "../env/app-mode.ts";
import { applyBrandingPatch } from "../configurator/applyBrandingOnly.ts";
import { getPublishedSystemDefaults } from "../templates/schema-index.ts";

const DEFAULT_DASHBOARD_ORIGIN = "http://localhost:3000";

let currentTemplateId: GameTemplateId = "dice-poker";

function getDashboardOrigin(): string | undefined {
  const envOrigin = import.meta.env.VITE_DASHBOARD_ORIGIN;
  if (typeof envOrigin === "string" && envOrigin.length > 0) {
    return envOrigin;
  }
  return undefined;
}

function getParentTargetOrigin(): string {
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      // fall through
    }
  }
  return getDashboardOrigin() ?? "*";
}

function isAllowedDashboardMessage(event: MessageEvent): boolean {
  if (event.source !== window.parent) return false;

  const configured = getDashboardOrigin();
  if (configured) return event.origin === configured;

  if (import.meta.env.DEV) return true;

  return (
    event.origin === DEFAULT_DASHBOARD_ORIGIN ||
    event.origin === "http://127.0.0.1:3000"
  );
}

function resolveConfigUpdate(
  message: UpdateConfigMessage,
  previous: GameMasterConfig,
): GameMasterConfig {
  const engineMode = getEngineMode();

  if (message.updateMode === "branding-patch") {
    const patch = message.payload as BrandingPatch;
    return applyBrandingPatch(previous, patch);
  }

  const normalized = normalizeGameMasterConfig(
    message.payload,
    currentTemplateId,
  );
  if (!normalized) return previous;

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
  onLoadTemplate: (templateId: GameTemplateId) => void;
  getCurrentConfig: () => GameMasterConfig;
  getCurrentTemplateId: () => GameTemplateId;
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
    if (!isAllowedDashboardMessage(event)) return;

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
        handlers.onUpdate(resolveConfigUpdate(message, previous));
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
      default:
        break;
    }
  });
}

export function setBridgeTemplateId(id: GameTemplateId): void {
  currentTemplateId = id;
}
