import {
  BRIDGE_MESSAGE_TYPE,
  isDiagnosticsPayloadMessage,
  isIframeReadyMessage,
  type AppMode,
  type BrandingPatch,
  type ConfigUpdateMode,
  type GameMasterConfig,
  type GameTemplateId,
  type LoadTemplateMessage,
  type UpdateConfigMessage,
} from "@advergaming/shared";

const GAME_ENGINE_URL =
  process.env.NEXT_PUBLIC_GAME_ENGINE_URL ?? "http://localhost:5173";

export const gameEngineOrigin = new URL(GAME_ENGINE_URL).origin;

export function getDashboardAppMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  return mode === "configurator" ? "configurator" : "studio";
}

type ConfigSender = GameMasterConfig | BrandingPatch;

class DashboardMessenger {
  private targetWindow: Window | null = null;
  private iframeReady = false;
  private pendingUpdates: {
    payload: ConfigSender;
    updateMode: ConfigUpdateMode;
    senderMode: AppMode;
  }[] = [];
  private pendingLoadTemplate: GameTemplateId | null = null;
  private diagnosticsHandler: ((payload: unknown) => void) | null = null;
  private readonly senderMode: AppMode;

  constructor(senderMode: AppMode = getDashboardAppMode()) {
    this.senderMode = senderMode;
  }

  setTarget(contentWindow: Window | null): void {
    this.targetWindow = contentWindow;
    if (this.iframeReady && contentWindow) {
      this.flush();
    }
  }

  onIframeNavigation(): void {
    this.iframeReady = false;
  }

  handleWindowMessage(event: MessageEvent): void {
    if (event.origin !== gameEngineOrigin) return;

    if (isIframeReadyMessage(event.data)) {
      this.iframeReady = true;
      this.flush();
      return;
    }

    if (isDiagnosticsPayloadMessage(event.data)) {
      this.diagnosticsHandler?.(event.data.payload);
    }
  }

  onDiagnostics(handler: (payload: unknown) => void): void {
    this.diagnosticsHandler = handler;
  }

  requestDiagnostics(): void {
    if (!this.iframeReady || !this.targetWindow) return;
    this.targetWindow.postMessage(
      { type: BRIDGE_MESSAGE_TYPE.REQUEST_DIAGNOSTICS },
      gameEngineOrigin,
    );
  }

  sendConfig(
    payload: ConfigSender,
    updateMode: ConfigUpdateMode = "full",
  ): void {
    if (this.iframeReady && this.targetWindow) {
      this.postConfig(payload, updateMode);
      return;
    }
    this.pendingUpdates = [{ payload, updateMode, senderMode: this.senderMode }];
  }

  sendLoadTemplate(templateId: GameTemplateId): void {
    if (this.iframeReady && this.targetWindow) {
      this.postLoadTemplate(templateId);
      return;
    }
    this.pendingLoadTemplate = templateId;
  }

  private flush(): void {
    if (!this.targetWindow) return;

    if (this.pendingLoadTemplate !== null) {
      this.postLoadTemplate(this.pendingLoadTemplate);
      this.pendingLoadTemplate = null;
    }

    const queue = this.pendingUpdates;
    this.pendingUpdates = [];

    for (const item of queue) {
      this.postConfig(item.payload, item.updateMode);
    }
  }

  private postConfig(
    payload: ConfigSender,
    updateMode: ConfigUpdateMode,
  ): void {
    if (!this.targetWindow) return;

    const message: UpdateConfigMessage = {
      type: BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG,
      payload,
      updateMode,
      senderMode: this.senderMode,
    };
    this.targetWindow.postMessage(message, gameEngineOrigin);
  }

  private postLoadTemplate(templateId: GameTemplateId): void {
    if (!this.targetWindow) return;

    const message: LoadTemplateMessage = {
      type: BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE,
      payload: templateId,
    };
    this.targetWindow.postMessage(message, gameEngineOrigin);
  }
}

export const dashboardMessenger = new DashboardMessenger();

export function createDashboardMessenger(mode: AppMode): DashboardMessenger {
  return new DashboardMessenger(mode);
}
