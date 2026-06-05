"use client";

import {
  createDashboardMessenger,
  gameEngineOrigin,
  getGameEngineOrigin,
  resolveGameEnginePreviewUrl,
} from "@/bridge/messenger";
import { useHitboxInboundBridge } from "@/hooks/useHitboxInboundBridge";
import { useGameChromeOverlayStore } from "@/lib/game-chrome-overlay-store";
import { usePreviewBridgeStore } from "@/lib/preview-bridge-store";
import { useBridgeSync } from "@/store/useBridgeSync";
import { useConfigStore } from "@/store/useConfigStore";
import type { AppMode, GameTemplateId } from "@mashedgames/shared";
import {
  GAME_CHROME_BRIDGE_EVENTS,
  parseGameChromeOverlaysRegistryPayload,
} from "@mashedgames/shared";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const PHONE_FRAME_WIDTH = 390;
const PHONE_FRAME_HEIGHT = 844;

export interface DevicePreviewProps {
  appMode: AppMode;
  initialTemplateId: GameTemplateId;
  /** Keep iframe mounted but pause dashboard ↔ game bridge (e.g. hidden workspace). */
  suspended?: boolean;
  /** @deprecated Alias for `suspended` used by CenterWorkspace. */
  previewSuspended?: boolean;
  /** React overlays mounted above the game iframe (studio template manifest). */
  overlaySlot?: ReactNode;
}

export function DevicePreview({
  appMode,
  initialTemplateId,
  suspended: suspendedProp = false,
  previewSuspended,
  overlaySlot,
}: DevicePreviewProps) {
  const suspended = previewSuspended ?? suspendedProp;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const phoneScreenRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const bootTemplateIdRef = useRef(initialTemplateId);
  const [phoneFrameSize, setPhoneFrameSize] = useState({
    width: PHONE_FRAME_WIDTH,
    height: PHONE_FRAME_HEIGHT,
  });
  const messenger = useMemo(
    () => createDashboardMessenger(appMode),
    [appMode],
  );

  const iframeSrc = useMemo(() => {
    return resolveGameEnginePreviewUrl(bootTemplateIdRef.current, appMode);
  }, [appMode]);

  useEffect(() => {
    if (suspended) {
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const bindIframeTarget = () => {
      const contentWindow = iframe.contentWindow;
      if (!contentWindow || contentWindow === window) {
        return;
      }
      useConfigStore.getState().setIframeTarget(contentWindow);
      useConfigStore.getState().setEngineReady(true);
      messenger.setTarget(contentWindow);
    };

    bindIframeTarget();
    iframe.addEventListener("load", bindIframeTarget);

    return () => {
      iframe.removeEventListener("load", bindIframeTarget);
      useConfigStore.getState().setIframeTarget(null);
      messenger.setTarget(null);
    };
  }, [iframeSrc, messenger, suspended]);

  useEffect(() => {
    useConfigStore.getState().setSelectedTemplateId(initialTemplateId);
  }, [initialTemplateId]);

  useBridgeSync({
    appMode,
    messenger,
    suspended,
    iframeRef,
    previewTemplateId: initialTemplateId,
  });

  useHitboxInboundBridge({
    messenger,
    enabled: !suspended,
    appMode,
  });

  useEffect(() => {
    if (suspended) {
      return;
    }

    useGameChromeOverlayStore.getState().setMessenger(messenger);
    usePreviewBridgeStore.getState().setMessenger(messenger);

    const onIframeMessage = (event: MessageEvent) => {
      messenger.handleWindowMessage(event);
    };

    const offGameEvent = messenger.onGameEvent((message) => {
      if (
        message.eventName !== GAME_CHROME_BRIDGE_EVENTS.OVERLAYS_REGISTRY
      ) {
        return;
      }
      const payload = parseGameChromeOverlaysRegistryPayload(message.data);
      if (!payload) return;
      useGameChromeOverlayStore.getState().setRegistry(payload.overlays);
    });

    window.addEventListener("message", onIframeMessage);

    return () => {
      offGameEvent();
      window.removeEventListener("message", onIframeMessage);
      messenger.setTarget(null);
      usePreviewBridgeStore.getState().setMessenger(null);
    };
  }, [messenger, suspended]);

  useEffect(() => {
    if (suspended) {
      return;
    }

    const screen = phoneScreenRef.current;
    const iframe = iframeRef.current;
    if (!screen || !iframe) return;

    const notifyEngineResize = () => {
      try {
        iframe.contentWindow?.dispatchEvent(new Event("resize"));
      } catch {
        // Cross-origin guard (should not happen for local dev origins).
      }
    };

    const observer = new ResizeObserver(() => {
      notifyEngineResize();
    });
    observer.observe(screen);

    const onLoad = () => {
      notifyEngineResize();
      requestAnimationFrame(notifyEngineResize);
      window.setTimeout(notifyEngineResize, 100);
      window.setTimeout(notifyEngineResize, 400);
    };
    iframe.addEventListener("load", onLoad);
    notifyEngineResize();

    return () => {
      observer.disconnect();
      iframe.removeEventListener("load", onLoad);
    };
  }, [iframeSrc, suspended]);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const updatePhoneFrameSize = () => {
      const { width, height } = container.getBoundingClientRect();
      const scale = Math.min(
        width / PHONE_FRAME_WIDTH,
        height / PHONE_FRAME_HEIGHT,
        1,
      );
      setPhoneFrameSize({
        width: Math.floor(PHONE_FRAME_WIDTH * scale),
        height: Math.floor(PHONE_FRAME_HEIGHT * scale),
      });
    };

    const observer = new ResizeObserver(updatePhoneFrameSize);
    observer.observe(container);
    updatePhoneFrameSize();

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden p-4">
      <div
        ref={previewContainerRef}
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
      >
        <div
          className="relative shrink-0"
          style={{
            width: phoneFrameSize.width,
            height: phoneFrameSize.height,
          }}
        >
          <div className="absolute inset-0 rounded-[2.5rem] bg-zinc-900 p-3 shadow-2xl shadow-zinc-900/20">
            <div className="absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
            <div
              ref={phoneScreenRef}
              className="relative h-full min-h-0 overflow-hidden rounded-[2rem] bg-black"
            >
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Game preview"
                className="block h-full min-h-[1px] w-full min-w-[1px] border-0"
              />
              {overlaySlot}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { getBridgePostMessageTargetOrigin, getGameEngineOrigin, gameEngineOrigin, resolveGameEnginePreviewUrl };
