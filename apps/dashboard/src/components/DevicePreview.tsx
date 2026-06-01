"use client";

import { useConfigStore } from "@/store/useConfigStore";
import {
  BRIDGE_MESSAGE_TYPE,
  isIframeReadyMessage,
  type GameMasterConfig,
  type UpdateConfigMessage,
} from "@advergaming/shared";
import { useEffect, useRef } from "react";

const GAME_ENGINE_URL =
  process.env.NEXT_PUBLIC_GAME_ENGINE_URL ?? "http://localhost:5173";

const gameEngineOrigin = new URL(GAME_ENGINE_URL).origin;

export function DevicePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const sendConfig = (config: GameMasterConfig) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      const message: UpdateConfigMessage = {
        type: BRIDGE_MESSAGE_TYPE.UPDATE_CONFIG,
        payload: config,
      };
      win.postMessage(message, gameEngineOrigin);
    };

    const unsubscribe = useConfigStore.subscribe((state) => {
      sendConfig(state.config);
    });

    const onIframeMessage = (event: MessageEvent) => {
      if (event.origin !== gameEngineOrigin) return;
      if (!isIframeReadyMessage(event.data)) return;
      sendConfig(useConfigStore.getState().config);
    };

    window.addEventListener("message", onIframeMessage);

    const iframe = iframeRef.current;
    const onLoad = () => sendConfig(useConfigStore.getState().config);
    iframe?.addEventListener("load", onLoad);

    return () => {
      unsubscribe();
      window.removeEventListener("message", onIframeMessage);
      iframe?.removeEventListener("load", onLoad);
    };
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-100 p-8">
      <div className="relative aspect-[390/844] max-h-[90vh] w-full max-w-[390px]">
        <div className="absolute inset-0 rounded-[2.5rem] bg-zinc-900 p-3 shadow-2xl shadow-zinc-900/20">
          <div className="absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
          <div className="relative h-full overflow-hidden rounded-[2rem] bg-black">
            <iframe
              ref={iframeRef}
              src={GAME_ENGINE_URL}
              title="Game preview"
              className="h-full w-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
