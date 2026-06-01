import {
  BRIDGE_MESSAGE_TYPE,
  isLoadTemplateMessage,
  isRequestDiagnosticsMessage,
  isUpdateConfigMessage,
  normalizeGameMasterConfig,
  type BrandingPatch,
  type GameMasterConfig,
  type GameTemplateId,
  type IframeReadyMessage,
} from "@advergaming/shared";
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

function isAllowedDashboardOrigin(origin: string): boolean {
  const configured = getDashboardOrigin();
  if (configured) return origin === configured;
  if (import.meta.env.DEV) {
    return (
      origin === DEFAULT_DASHBOARD_ORIGIN ||
      origin === "http://127.0.0.1:3000"
    );
  }
  return origin === DEFAULT_DASHBOARD_ORIGIN;
}

function resolveConfigUpdate(
  message: Extract<
    import("@advergaming/shared").UpdateConfigMessage,
    { type: typeof BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG }
  >,
  previous: GameMasterConfig,
): GameMasterConfig {
  const engineMode = getEngineMode();

  if (message.updateMode === "branding-patch") {
    const patch = message.payload as BrandingPatch;
    return applyBrandingPatch(previous, patch);
  }

  const normalized = normalizeGameMasterConfig(message.payload, currentTemplateId);
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
      },
    };
    window.parent.postMessage(iframeReadyMessage, getParentTargetOrigin());
  };

  postReady();

  window.addEventListener("message", (event: MessageEvent) => {
    if (!isAllowedDashboardOrigin(event.origin)) return;

    if (isUpdateConfigMessage(event.data)) {
      const previous = handlers.getCurrentConfig();
      handlers.onUpdate(resolveConfigUpdate(event.data, previous));
      return;
    }

    if (isLoadTemplateMessage(event.data)) {
      currentTemplateId = event.data.payload;
      handlers.onLoadTemplate(event.data.payload);
      postReady();
      return;
    }

    if (isRequestDiagnosticsMessage(event.data)) {
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
    }
  });
}

export function setBridgeTemplateId(id: GameTemplateId): void {
  currentTemplateId = id;
}
