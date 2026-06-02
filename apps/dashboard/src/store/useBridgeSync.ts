"use client";

import { useGameChromeOverlayStore } from "@/lib/game-chrome-overlay-store";
import { useEditorStore } from "@/store/useEditorStore";
import {
  buildBridgePayload,
  type AppMode,
  type ConfigUpdateMode,
  type GameMasterConfig,
  type GameTemplateId,
} from "@advergaming/shared";
import { useEffect, useRef } from "react";

type DashboardMessenger = {
  initSync: (contentWindow: Window | null, templateId: GameTemplateId) => void;
  reactivateAttachedIframe: (
    contentWindow: Window | null,
    templateId: GameTemplateId,
  ) => void;
  onIframeNavigation: (expectedTemplateId: GameTemplateId) => void;
  sendBridgePayload: (
    payload: ReturnType<typeof buildBridgePayload>,
    updateMode?: ConfigUpdateMode,
  ) => void;
  setTarget: (contentWindow: Window | null) => void;
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
  previewTemplateId: GameTemplateId;
  onTemplateChange?: (templateId: GameTemplateId) => void;
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
  onTemplateChange,
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

    const pushBridgePayload = () => {
      const payload = buildBridgePayload(
        useEditorStore.getState(),
        getConfig(),
        appMode,
      );
      messenger.sendBridgePayload(payload, configUpdateMode);
    };

    let lastTemplateId = previewTemplateId;

    const unsubscribeConfig = subscribe((state) => {
      const templateChanged = state.selectedTemplateId !== lastTemplateId;
      if (templateChanged) {
        lastTemplateId = state.selectedTemplateId;
        previewTemplateIdRef.current = state.selectedTemplateId;
        onTemplateChange?.(state.selectedTemplateId);
        useEditorStore.getState().reset();
        useGameChromeOverlayStore.getState().clearRegistry();
        messenger.onIframeNavigation(state.selectedTemplateId);
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
      unsubscribeConfig();
      unsubscribeEditor();
    };
  }, [
    appMode,
    configUpdateMode,
    getConfig,
    iframeRef,
    messenger,
    onTemplateChange,
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
      window.setTimeout(pushBridgePayload, 150);
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
