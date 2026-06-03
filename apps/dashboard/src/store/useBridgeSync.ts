"use client";

import { pushRuntimeAssetsToPreview } from "@/lib/preview-bridge-store";
import { useGameChromeOverlayStore } from "@/lib/game-chrome-overlay-store";
import { useEditorStore } from "@/store/useEditorStore";
import { useTemplateBridgeStore } from "@/store/useTemplateBridgeStore";
import {
  buildBridgePayload,
  type AppMode,
  type ConfigUpdateMode,
  type GameMasterConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import { useEffect, useRef } from "react";

type DashboardMessenger = {
  initSync: (contentWindow: Window | null, templateId: GameTemplateId) => void;
  reactivateAttachedIframe: (
    contentWindow: Window | null,
    templateId: GameTemplateId,
  ) => void;
  sendBridgePayload: (
    payload: ReturnType<typeof buildBridgePayload>,
    updateMode?: ConfigUpdateMode,
  ) => void;
  sendLoadTemplate: (templateId: GameTemplateId) => void;
  sendRuntimeAssets?: (assets: Record<string, string>) => void;
  setTarget: (contentWindow: Window | null) => void;
  onIframeReady: (
    handler: (capabilities: { templateId: GameTemplateId }) => void,
  ) => () => void;
};

export interface UseBridgeSyncOptions {
  appMode: AppMode;
  getConfig: () => GameMasterConfig;
  subscribe: (
    listener: (state: {
      config: GameMasterConfig;
      selectedTemplateId: GameTemplateId;
    }) => void,
  ) => () => void;
  messenger: DashboardMessenger;
  configUpdateMode?: ConfigUpdateMode;
  suspended?: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Initial template id before subscribe delivers state. */
  previewTemplateId: GameTemplateId;
}

export function useBridgeSync({
  appMode,
  getConfig,
  subscribe,
  messenger,
  configUpdateMode = "full",
  suspended = false,
  iframeRef,
  previewTemplateId,
}: UseBridgeSyncOptions): void {
  const previewTemplateIdRef = useRef(previewTemplateId);

  useEffect(() => {
    previewTemplateIdRef.current = previewTemplateId;
  }, [previewTemplateId]);

  useEffect(() => {
    useEditorStore.getState().setWorkspaceMode(appMode);
  }, [appMode]);

  useEffect(() => {
    if (suspended) {
      return;
    }

    const offReady = messenger.onIframeReady((capabilities) => {
      useTemplateBridgeStore
        .getState()
        .completeTemplateChange(capabilities.templateId);
      messenger.reactivateAttachedIframe(
        iframeRef.current?.contentWindow ?? null,
        capabilities.templateId,
      );
      previewTemplateIdRef.current = capabilities.templateId;
    });

    const pushBridgePayload = () => {
      if (useTemplateBridgeStore.getState().templateChangeInProgress) {
        return;
      }
      const payload = buildBridgePayload(
        useEditorStore.getState(),
        getConfig(),
        appMode,
      );
      messenger.sendBridgePayload(payload, configUpdateMode);
    };

    let lastTemplateId = previewTemplateIdRef.current;

    const unsubscribeConfig = subscribe((state) => {
      const templateChanged = state.selectedTemplateId !== lastTemplateId;
      if (templateChanged) {
        lastTemplateId = state.selectedTemplateId;
        previewTemplateIdRef.current = state.selectedTemplateId;
        useEditorStore.getState().reset();
        useGameChromeOverlayStore.getState().clearRegistry();
        useTemplateBridgeStore
          .getState()
          .beginTemplateChange(state.selectedTemplateId);

        messenger.sendLoadTemplate(state.selectedTemplateId);

        const payload = buildBridgePayload(
          useEditorStore.getState(),
          {
            ...state.config,
            meta: {
              ...state.config.meta,
              templateId: state.selectedTemplateId,
            },
          },
          appMode,
        );
        messenger.sendBridgePayload(payload, configUpdateMode);
        return;
      }

      pushBridgePayload();
    });

    const unsubscribeEditor = useEditorStore.subscribe(() => {
      pushBridgePayload();
    });

    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      messenger.reactivateAttachedIframe(
        iframe.contentWindow,
        previewTemplateIdRef.current,
      );
      pushBridgePayload();
    }

    return () => {
      offReady();
      unsubscribeConfig();
      unsubscribeEditor();
    };
  }, [
    appMode,
    configUpdateMode,
    getConfig,
    iframeRef,
    messenger,
    previewTemplateId,
    subscribe,
    suspended,
  ]);

  useEffect(() => {
    if (suspended) {
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const pushBridgePayload = () => {
      if (useTemplateBridgeStore.getState().templateChangeInProgress) {
        return;
      }
      const payload = buildBridgePayload(
        useEditorStore.getState(),
        getConfig(),
        appMode,
      );
      messenger.sendBridgePayload(payload, configUpdateMode);
    };

    const onLoad = () => {
      messenger.initSync(
        iframe.contentWindow ?? null,
        previewTemplateIdRef.current,
      );
      useGameChromeOverlayStore.getState().clearRegistry();
      pushBridgePayload();
      pushRuntimeAssetsToPreview();
      window.setTimeout(() => {
        pushBridgePayload();
        pushRuntimeAssetsToPreview();
      }, 150);
    };

    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") {
      onLoad();
    }

    return () => iframe.removeEventListener("load", onLoad);
  }, [
    appMode,
    configUpdateMode,
    getConfig,
    iframeRef,
    messenger,
    previewTemplateId,
    suspended,
  ]);
}
