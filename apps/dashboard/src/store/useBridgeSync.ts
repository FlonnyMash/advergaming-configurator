"use client";

import { pushRuntimeAssetsToPreview } from "@/lib/preview-bridge-store";
import { flushConfigToIframe, useConfigStore } from "@/store/useConfigStore";
import { useTemplateBridgeStore } from "@/store/useTemplateBridgeStore";
import type { AppMode, GameTemplateId } from "@mashedgames/shared";
import { useEffect, useRef } from "react";

type DashboardMessenger = {
  initSync: (contentWindow: Window | null, templateId: GameTemplateId) => void;
  reactivateAttachedIframe: (
    contentWindow: Window | null,
    templateId: GameTemplateId,
  ) => void;
  sendUpdateConfig: (
    config: ReturnType<typeof useConfigStore.getState>["config"],
  ) => void;
  sendConfigUpdated: (
    config: ReturnType<typeof useConfigStore.getState>["config"],
  ) => void;
  sendLoadTemplate: (templateId: GameTemplateId) => void;
  sendRuntimeAssets?: (assets: Record<string, string>) => void;
  setTarget: (contentWindow: Window | null) => void;
  onEngineReady: (
    handler: (payload: { activeTemplateId: GameTemplateId }) => void,
  ) => () => void;
};

export interface UseBridgeSyncOptions {
  appMode: AppMode;
  messenger: DashboardMessenger;
  suspended?: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewTemplateId: GameTemplateId;
}

export function useBridgeSync({
  appMode,
  messenger,
  suspended = false,
  iframeRef,
  previewTemplateId,
}: UseBridgeSyncOptions): void {
  const previewTemplateIdRef = useRef(previewTemplateId);

  useEffect(() => {
    previewTemplateIdRef.current = previewTemplateId;
  }, [previewTemplateId]);

  useEffect(() => {
    if (suspended) {
      return;
    }

    const offReady = messenger.onEngineReady((payload) => {
      useConfigStore.getState().setEngineReady(true);
      const contentWindow = iframeRef.current?.contentWindow ?? null;
      useConfigStore.getState().setIframeTarget(contentWindow);
      if (contentWindow) {
        messenger.setTarget(contentWindow);
      }
      useTemplateBridgeStore
        .getState()
        .completeTemplateChange(payload.activeTemplateId);
      messenger.reactivateAttachedIframe(
        iframeRef.current?.contentWindow ?? null,
        payload.activeTemplateId,
      );
      previewTemplateIdRef.current = payload.activeTemplateId;
      flushConfigToIframe();
      pushRuntimeAssetsToPreview();
    });

    let lastTemplateId = previewTemplateIdRef.current;

    const unsubscribeConfig = useConfigStore.subscribe((state, prev) => {
      const templateChanged = state.selectedTemplateId !== lastTemplateId;
      if (templateChanged) {
        lastTemplateId = state.selectedTemplateId;
        previewTemplateIdRef.current = state.selectedTemplateId;
        useTemplateBridgeStore
          .getState()
          .beginTemplateChange(state.selectedTemplateId);
        messenger.sendLoadTemplate(state.selectedTemplateId);
        flushConfigToIframe();
        return;
      }
    });

    const iframe = iframeRef.current;
    if (iframe?.contentWindow && iframe.contentWindow !== window) {
      useConfigStore.getState().setIframeTarget(iframe.contentWindow);
      messenger.setTarget(iframe.contentWindow);
      messenger.reactivateAttachedIframe(
        iframe.contentWindow,
        previewTemplateIdRef.current,
      );
      flushConfigToIframe();
    }

    return () => {
      offReady();
      unsubscribeConfig();
      useConfigStore.getState().setEngineReady(false);
      useConfigStore.getState().setIframeTarget(null);
      messenger.setTarget(null);
    };
  }, [appMode, iframeRef, messenger, previewTemplateId, suspended]);

  useEffect(() => {
    if (suspended) {
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const onLoad = () => {
      useConfigStore.getState().setEngineReady(false);
      const contentWindow = iframe.contentWindow;
      useConfigStore.getState().setIframeTarget(contentWindow ?? null);
      messenger.setTarget(contentWindow ?? null);
      messenger.initSync(contentWindow ?? null, previewTemplateIdRef.current);
      flushConfigToIframe();
      pushRuntimeAssetsToPreview();
      window.setTimeout(() => {
        flushConfigToIframe();
        pushRuntimeAssetsToPreview();
      }, 150);
    };

    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") {
      onLoad();
    }

    return () => iframe.removeEventListener("load", onLoad);
  }, [appMode, iframeRef, messenger, previewTemplateId, suspended]);
}
