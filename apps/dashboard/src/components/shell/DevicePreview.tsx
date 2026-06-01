"use client";

import {
  createDashboardMessenger,
  gameEngineOrigin,
} from "@/bridge/messenger";
import type { AppMode, ConfigUpdateMode, GameMasterConfig, GameTemplateId } from "@advergaming/shared";
import { useEffect, useMemo, useRef } from "react";

const GAME_ENGINE_URL =
  process.env.NEXT_PUBLIC_GAME_ENGINE_URL ?? "http://localhost:5173";

export interface DevicePreviewProps {
  appMode: AppMode;
  initialTemplateId: GameTemplateId;
  getConfig: () => GameMasterConfig;
  subscribe: (
    listener: (state: {
      config: GameMasterConfig;
      selectedTemplateId: GameTemplateId;
    }) => void,
  ) => () => void;
  configUpdateMode?: ConfigUpdateMode;
}

export function DevicePreview({
  appMode,
  initialTemplateId,
  getConfig,
  subscribe,
  configUpdateMode = "full",
}: DevicePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messenger = useMemo(
    () => createDashboardMessenger(appMode),
    [appMode],
  );

  const iframeSrc = (() => {
    const url = new URL(GAME_ENGINE_URL);
    url.searchParams.set("game", initialTemplateId);
    url.searchParams.set("appMode", appMode);
    return url.toString();
  })();

  useEffect(() => {
    const syncTarget = () => {
      messenger.setTarget(iframeRef.current?.contentWindow ?? null);
    };

    let lastTemplateId = initialTemplateId;

    const unsubscribe = subscribe((state) => {
      if (state.selectedTemplateId !== lastTemplateId) {
        messenger.sendLoadTemplate(state.selectedTemplateId);
        lastTemplateId = state.selectedTemplateId;
      }
      if (configUpdateMode === "branding-patch") {
        messenger.sendConfig(state.config.branding, "branding-patch");
      } else {
        messenger.sendConfig(state.config, "full");
      }
    });

    const onIframeMessage = (event: MessageEvent) => {
      messenger.handleWindowMessage(event);
    };

    window.addEventListener("message", onIframeMessage);
    syncTarget();

    const iframe = iframeRef.current;
    const onLoad = () => {
      messenger.onIframeNavigation();
      syncTarget();
      const config = getConfig();
      if (configUpdateMode === "branding-patch") {
        messenger.sendConfig(config.branding, "branding-patch");
      } else {
        messenger.sendConfig(config, "full");
      }
    };
    iframe?.addEventListener("load", onLoad);

    return () => {
      unsubscribe();
      window.removeEventListener("message", onIframeMessage);
      iframe?.removeEventListener("load", onLoad);
      messenger.setTarget(null);
    };
  }, [messenger, subscribe, getConfig, configUpdateMode]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-100 p-8">
      <div className="relative aspect-[390/844] max-h-[90vh] w-full max-w-[390px]">
        <div className="absolute inset-0 rounded-[2.5rem] bg-zinc-900 p-3 shadow-2xl shadow-zinc-900/20">
          <div className="absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
          <div className="relative h-full overflow-hidden rounded-[2rem] bg-black">
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Game preview"
              className="h-full w-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { gameEngineOrigin };
