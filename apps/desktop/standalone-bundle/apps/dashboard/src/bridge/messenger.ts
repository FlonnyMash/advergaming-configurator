import {
  BRIDGE_MESSAGE_TYPE,
  DiagnosticsPayloadMessageSchema,
  IframeReadyMessageSchema,
  isDiagnosticsPayloadMessage,
  isGameEventMessage,
  isIframeReadyMessage,
  type GameEventMessage,
  type IframeReadyMessage,
  LoadTemplateMessageSchema,
  RequestDiagnosticsMessageSchema,
  UpdateConfigMessageSchema,
  type AppMode,
  type BrandingPatch,
  type ConfigUpdateMode,
  type GameMasterConfig,
  type GameTemplateId,
  type LoadTemplateMessage,
  type UpdateConfigMessage,
} from "@mashedgames/shared";

const isDev = process.env.NODE_ENV === "development";

function warnIfInvalid(
  schema: {
    safeParse: (
      data: unknown,
    ) =>
      | { success: true }
      | { success: false; error: { flatten: () => unknown } };
  },
  data: unknown,
  label: string,
): void {
  if (!isDev) return;
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[DashboardMessenger] Invalid ${label}:`,
      result.error.flatten(),
    );
  }
}

const DEV_GAME_ENGINE_URL =
  process.env.NEXT_PUBLIC_GAME_ENGINE_URL ?? "http://localhost:5173";

/** Static engine preview is same-origin under `/engine` (desktop + production web). */
export function getGameEngineOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return new URL(DEV_GAME_ENGINE_URL).origin;
}

/** @deprecated Prefer getGameEngineOrigin() for runtime same-origin embedded engine. */
export const gameEngineOrigin = getGameEngineOrigin();

export function getDashboardAppMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  return mode === "configurator" ? "configurator" : "studio";
}

type ConfigSender = GameMasterConfig | BrandingPatch;

class DashboardMessenger {
  private targetWindow: Window | null = null;
  private iframeReady = false;
  private expectedTemplateId: GameTemplateId | null = null;
  private pendingUpdates: {
    payload: ConfigSender;
    updateMode: ConfigUpdateMode;
    senderMode: AppMode;
  }[] = [];
  private pendingLoadTemplate: GameTemplateId | null = null;
  private diagnosticsHandler: ((payload: unknown) => void) | null = null;
  private gameEventHandler: ((message: GameEventMessage) => void) | null =
    null;
  private iframeReadyHandler:
    | ((capabilities: IframeReadyMessage["capabilities"]) => void)
    | null = null;
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

  /**
   * Call when the preview iframe finishes loading a new game URL.
   * Binds the content window and records which template this navigation expects.
   */
  armIframe(contentWindow: Window | null, templateId: GameTemplateId): void {
    this.expectedTemplateId = templateId;
    this.setTarget(contentWindow);
  }

  /**
   * Re-bind a preview iframe that stayed mounted while this messenger was suspended
   * (e.g. switching Studio ↔ Configurator). Assumes the game is already running.
   */
  reactivateAttachedIframe(
    contentWindow: Window | null,
    templateId: GameTemplateId,
  ): void {
    this.expectedTemplateId = templateId;
    this.targetWindow = contentWindow;
    if (!contentWindow) {
      this.iframeReady = false;
      return;
    }
    this.iframeReady = true;
    this.flush();
  }

  onIframeNavigation(expectedTemplateId: GameTemplateId): void {
    this.iframeReady = false;
    this.targetWindow = null;
    this.expectedTemplateId = expectedTemplateId;
    this.pendingUpdates = [];
    this.pendingLoadTemplate = null;
  }

  private acceptsIframeReady(
    event: MessageEvent,
    capabilities: IframeReadyMessage["capabilities"],
  ): boolean {
    if (
      this.expectedTemplateId !== null &&
      capabilities.templateId !== this.expectedTemplateId
    ) {
      return false;
    }
    if (this.targetWindow !== null && event.source !== this.targetWindow) {
      return false;
    }
    if (event.source instanceof Window) {
      this.targetWindow = event.source;
    }
    return true;
  }

  handleWindowMessage(event: MessageEvent): void {
    if (event.origin !== getGameEngineOrigin()) return;

    if (isIframeReadyMessage(event.data)) {
      warnIfInvalid(IframeReadyMessageSchema, event.data, "IFRAME_READY");
      if (!this.acceptsIframeReady(event, event.data.capabilities)) {
        return;
      }
      this.iframeReady = true;
      this.iframeReadyHandler?.(event.data.capabilities);
      this.flush();
      return;
    }

    if (isGameEventMessage(event.data)) {
      this.gameEventHandler?.(event.data);
      return;
    }

    if (isDiagnosticsPayloadMessage(event.data)) {
      warnIfInvalid(
        DiagnosticsPayloadMessageSchema,
        event.data,
        "DIAGNOSTICS_PAYLOAD",
      );
      this.diagnosticsHandler?.(event.data.payload);
    }
  }

  onDiagnostics(handler: (payload: unknown) => void): void {
    this.diagnosticsHandler = handler;
  }

  onIframeReady(
    handler: (capabilities: IframeReadyMessage["capabilities"]) => void,
  ): () => void {
    this.iframeReadyHandler = handler;
    return () => {
      if (this.iframeReadyHandler === handler) {
        this.iframeReadyHandler = null;
      }
    };
  }

  onGameEvent(handler: (message: GameEventMessage) => void): () => void {
    this.gameEventHandler = handler;
    return () => {
      if (this.gameEventHandler === handler) {
        this.gameEventHandler = null;
      }
    };
  }

  sendGameEvent(eventName: string, data: unknown): void {
    if (!this.iframeReady || !this.targetWindow) return;
    const message: GameEventMessage = {
      type: BRIDGE_MESSAGE_TYPE.GAME_EVENT,
      eventName,
      data,
    };
    this.targetWindow.postMessage(message, getGameEngineOrigin());
  }

  requestDiagnostics(): void {
    if (!this.iframeReady || !this.targetWindow) return;
    const message = { type: BRIDGE_MESSAGE_TYPE.REQUEST_DIAGNOSTICS };
    warnIfInvalid(
      RequestDiagnosticsMessageSchema,
      message,
      "REQUEST_DIAGNOSTICS",
    );
    this.targetWindow.postMessage(message, getGameEngineOrigin());
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
    this.expectedTemplateId = templateId;
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
    warnIfInvalid(UpdateConfigMessageSchema, message, "UPDATE_CONFIG");
    this.targetWindow.postMessage(message, getGameEngineOrigin());
  }

  private postLoadTemplate(templateId: GameTemplateId): void {
    if (!this.targetWindow) return;

    const message: LoadTemplateMessage = {
      type: BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE,
      payload: templateId,
    };
    warnIfInvalid(LoadTemplateMessageSchema, message, "LOAD_TEMPLATE");
    this.targetWindow.postMessage(message, getGameEngineOrigin());
  }
}

export const dashboardMessenger = new DashboardMessenger();

export function createDashboardMessenger(mode: AppMode): DashboardMessenger {
  return new DashboardMessenger(mode);
}
