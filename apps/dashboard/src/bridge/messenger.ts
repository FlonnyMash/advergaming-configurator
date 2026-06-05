import {
  AssetReadyPayloadSchema,
  AssetLoadErrorMessageSchema,
  BRIDGE_MESSAGE_TYPE,
  ConfigUpdatedMessageSchema,
  EngineReadyMessageSchema,
  GameConfigSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
  cloneForBridgePostMessage,
  isAssetLoadErrorMessage,
  isEngineReadyMessage,
  isGameEventMessage,
  isHitboxUpdatedMessage,
  isLoadTemplateMessage,
  resolveGameEngineBaseUrl,
  type AppMode,
  type AssetLoadErrorPayload,
  type AssetReadyPayload,
  type GameConfig,
  type GameEventMessage,
  type GameTemplateId,
  type HitboxUpdatePayload,
  LoadTemplateMessageSchema,
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

/** Origin of inbound postMessage events from the game-engine iframe. */
export function getGameEngineOrigin(): string {
  if (typeof window === "undefined") {
    return new URL(DEV_GAME_ENGINE_URL).origin;
  }

  const base = resolveGameEngineBaseUrl().replace(/\/$/, "");
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL(base).origin;
  }

  return window.location.origin;
}

/**
 * targetOrigin for dashboard → iframe postMessage.
 * Dev uses '*' so cross-origin Vite preview (localhost:5173) always receives.
 */
export function getBridgePostMessageTargetOrigin(): string {
  if (isDev) {
    return "*";
  }
  return getGameEngineOrigin();
}

export function resolveGameEnginePreviewUrl(
  templateId: GameTemplateId,
  appMode: AppMode,
): string {
  const base = resolveGameEngineBaseUrl().replace(/\/$/, "");
  const url =
    base.startsWith("http://") || base.startsWith("https://")
      ? new URL(`${base}/index.html`)
      : new URL(`${base}/index.html`, window.location.origin);
  url.searchParams.set("game", templateId);
  url.searchParams.set("appMode", appMode);
  return url.toString();
}

function isAllowedEngineMessageOrigin(origin: string): boolean {
  if (origin === getGameEngineOrigin()) {
    return true;
  }
  if (!isDev) {
    return false;
  }
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function postMessageToIframe(
  targetWindow: Window,
  message: unknown,
  label: string,
): void {
  const targetOrigin = getBridgePostMessageTargetOrigin();
  if (isDev && label === "CONFIG_UPDATED") {
    console.log(
      `[Dashboard Bridge] Sending ${label}:`,
      (message as { payload?: unknown }).payload ?? message,
      "→ iframe",
      targetOrigin,
    );
  }
  targetWindow.postMessage(message, targetOrigin);
}

/** @deprecated Prefer getGameEngineOrigin() for runtime embedded engine origin checks. */
export const gameEngineOrigin = getGameEngineOrigin();

export function getDashboardAppMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  return mode === "configurator" ? "configurator" : "studio";
}

class DashboardMessenger {
  private targetWindow: Window | null = null;
  private engineReady = false;
  private expectedTemplateId: GameTemplateId | null = null;
  private pendingConfig: GameConfig | null = null;
  private pendingLoadTemplate: GameTemplateId | null = null;
  private gameEventHandler: ((message: GameEventMessage) => void) | null =
    null;
  private hitboxUpdatedHandler: ((payload: HitboxUpdatePayload) => void) | null =
    null;
  private assetReadyHandler: ((payload: AssetReadyPayload) => void) | null =
    null;
  private engineReadyHandler:
    | ((payload: { activeTemplateId: GameTemplateId }) => void)
    | null = null;
  private assetLoadErrorHandler: ((payload: AssetLoadErrorPayload) => void) | null =
    null;
  private readonly senderMode: AppMode;

  constructor(senderMode: AppMode = getDashboardAppMode()) {
    this.senderMode = senderMode;
  }

  setTarget(contentWindow: Window | null): void {
    this.targetWindow = contentWindow;
    if (this.engineReady && contentWindow) {
      this.flush();
    }
  }

  initSync(contentWindow: Window | null, templateId: GameTemplateId): void {
    this.engineReady = false;
    this.armIframe(contentWindow, templateId);
  }

  armIframe(contentWindow: Window | null, templateId: GameTemplateId): void {
    this.expectedTemplateId = templateId;
    this.setTarget(contentWindow);
  }

  reactivateAttachedIframe(
    contentWindow: Window | null,
    templateId: GameTemplateId,
  ): void {
    this.expectedTemplateId = templateId;
    this.targetWindow = contentWindow;
    if (!contentWindow) {
      this.engineReady = false;
      return;
    }
    this.engineReady = true;
    this.flush();
  }

  onIframeNavigation(expectedTemplateId: GameTemplateId): void {
    this.engineReady = false;
    this.targetWindow = null;
    this.expectedTemplateId = expectedTemplateId;
    this.pendingConfig = null;
    this.pendingLoadTemplate = null;
  }

  private acceptsEngineReady(
    event: MessageEvent,
    payload: { activeTemplateId: GameTemplateId },
  ): boolean {
    if (
      this.expectedTemplateId !== null &&
      payload.activeTemplateId !== this.expectedTemplateId
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
    if (!isAllowedEngineMessageOrigin(event.origin)) return;

    if (isEngineReadyMessage(event.data)) {
      warnIfInvalid(EngineReadyMessageSchema, event.data, "ENGINE_READY");
      if (!this.acceptsEngineReady(event, event.data.payload)) {
        return;
      }
      this.engineReady = true;
      this.engineReadyHandler?.(event.data.payload);
      this.flush();
      return;
    }

    if (isGameEventMessage(event.data)) {
      this.gameEventHandler?.(event.data);
      return;
    }

    if (isHitboxUpdatedMessage(event.data)) {
      this.hitboxUpdatedHandler?.(event.data.payload);
      return;
    }

    if (isAssetLoadErrorMessage(event.data)) {
      warnIfInvalid(AssetLoadErrorMessageSchema, event.data, "ASSET_LOAD_ERROR");
      if (isDev) {
        console.warn(
          "[DashboardMessenger] Asset load error:",
          event.data.payload,
        );
      }
      this.assetLoadErrorHandler?.(event.data.payload);
      return;
    }

    if (
      typeof event.data === "object" &&
      event.data !== null &&
      "type" in event.data &&
      event.data.type === BRIDGE_MESSAGE_TYPE.ASSET_READY &&
      "payload" in event.data
    ) {
      const parsed = AssetReadyPayloadSchema.safeParse(
        (event.data as { payload: unknown }).payload,
      );
      if (parsed.success) {
        this.assetReadyHandler?.(parsed.data);
      }
      return;
    }
  }

  onEngineReady(
    handler: (payload: { activeTemplateId: GameTemplateId }) => void,
  ): () => void {
    this.engineReadyHandler = handler;
    return () => {
      if (this.engineReadyHandler === handler) {
        this.engineReadyHandler = null;
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

  onHitboxUpdated(handler: (payload: HitboxUpdatePayload) => void): () => void {
    this.hitboxUpdatedHandler = handler;
    return () => {
      if (this.hitboxUpdatedHandler === handler) {
        this.hitboxUpdatedHandler = null;
      }
    };
  }

  onAssetReady(handler: (payload: AssetReadyPayload) => void): () => void {
    this.assetReadyHandler = handler;
    return () => {
      if (this.assetReadyHandler === handler) {
        this.assetReadyHandler = null;
      }
    };
  }

  onAssetLoadError(
    handler: (payload: AssetLoadErrorPayload) => void,
  ): () => void {
    this.assetLoadErrorHandler = handler;
    return () => {
      if (this.assetLoadErrorHandler === handler) {
        this.assetLoadErrorHandler = null;
      }
    };
  }

  sendLoadExternalAsset(key: string, absolutePath: string): void {
    if (!this.engineReady || !this.targetWindow) return;
    const message = {
      type: BRIDGE_MESSAGE_TYPE.LOAD_EXTERNAL_ASSET,
      payload: { key, absolutePath },
    };
    if (isDev) {
      LoadExternalAssetPayloadSchema.safeParse(message.payload);
    }
    this.targetWindow.postMessage(message, getBridgePostMessageTargetOrigin());
  }

  sendRuntimeAssets(assets: Record<string, string>): void {
    if (!this.engineReady || !this.targetWindow) return;
    const message = {
      type: BRIDGE_MESSAGE_TYPE.SET_RUNTIME_ASSETS,
      payload: { assets },
    };
    if (isDev) {
      SetRuntimeAssetsPayloadSchema.safeParse(message.payload);
    }
    this.targetWindow.postMessage(message, getBridgePostMessageTargetOrigin());
  }

  sendConfigUpdated(config: GameConfig): void {
    const safeConfig = cloneForBridgePostMessage(config);
    const parsed = GameConfigSchema.safeParse(safeConfig);
    if (!parsed.success) {
      devWarn("sendConfigUpdated rejected", parsed.error.flatten());
      return;
    }

    if (this.engineReady && this.targetWindow) {
      this.postConfigUpdated(parsed.data);
      return;
    }
    this.pendingConfig = parsed.data;
  }

  sendGameEvent(eventName: string, data: unknown): void {
    if (!this.engineReady || !this.targetWindow) return;
    const message: GameEventMessage = {
      type: BRIDGE_MESSAGE_TYPE.GAME_EVENT,
      eventName,
      data,
    };
    this.targetWindow.postMessage(message, getBridgePostMessageTargetOrigin());
  }

  sendLoadTemplate(templateId: GameTemplateId): void {
    this.expectedTemplateId = templateId;
    if (this.engineReady && this.targetWindow) {
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

    if (this.pendingConfig !== null) {
      this.postConfigUpdated(this.pendingConfig);
      this.pendingConfig = null;
    }
  }

  private postConfigUpdated(config: GameConfig): void {
    if (!this.targetWindow || this.targetWindow === window) return;

    const message = {
      type: BRIDGE_MESSAGE_TYPE.CONFIG_UPDATED,
      payload: config,
    };
    warnIfInvalid(ConfigUpdatedMessageSchema, message, "CONFIG_UPDATED");
    postMessageToIframe(this.targetWindow, message, "CONFIG_UPDATED");
  }

  private postLoadTemplate(templateId: GameTemplateId): void {
    if (!this.targetWindow || this.targetWindow === window) return;

    const message = {
      type: BRIDGE_MESSAGE_TYPE.LOAD_TEMPLATE,
      payload: templateId,
    };
    warnIfInvalid(LoadTemplateMessageSchema, message, "LOAD_TEMPLATE");
    this.targetWindow.postMessage(message, getBridgePostMessageTargetOrigin());
  }
}

function devWarn(label: string, detail: unknown): void {
  if (!isDev) return;
  console.warn(`[DashboardMessenger] ${label}:`, detail);
}

export const dashboardMessenger = new DashboardMessenger();

export function createDashboardMessenger(mode: AppMode): DashboardMessenger {
  return new DashboardMessenger(mode);
}
