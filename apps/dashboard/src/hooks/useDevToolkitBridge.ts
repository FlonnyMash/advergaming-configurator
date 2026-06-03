"use client";

import { getGameEngineOrigin } from "@/bridge/messenger";
import {
  publishDevToolkitSync,
  subscribeDevToolkitSync,
  type DevToolkitSyncMessage,
} from "@/lib/dev-toolkit-sync";
import { useDevToolkitStore } from "@/lib/dev-toolkit-store";
import { useGameChromeOverlayStore } from "@/lib/game-chrome-overlay-store";
import {
  DEFAULT_DEV_TOOLKIT_FLAGS,
  DEV_TOOLKIT_BRIDGE_EVENTS,
  parseDevToolkitFlags,
  parseDevToolkitPickedAsset,
  type DevToolkitSetFlagsPayload,
} from "@mashedgames/shared";
import { useWorkspaceCenterStore } from "@/lib/workspace-center-store";
import { useEditorStore } from "@/store/useEditorStore";
import { useCallback, useEffect } from "react";

export function useDevToolkitControls(options?: { relayToGame?: boolean }) {
  const relayToGame = options?.relayToGame ?? true;
  const messenger = useGameChromeOverlayStore((state) => state.messenger);

  const flags = useDevToolkitStore((state) => state.flags);
  const patchFlags = useDevToolkitStore((state) => state.patchFlags);
  const reset = useDevToolkitStore((state) => state.reset);

  const sendFlags = useCallback(
    (patch: DevToolkitSetFlagsPayload) => {
      patchFlags(patch);
      publishDevToolkitSync({ type: "setFlags", patch });
      if (relayToGame) {
        messenger?.sendGameEvent(DEV_TOOLKIT_BRIDGE_EVENTS.SET_FLAGS, patch);
      }
    },
    [messenger, patchFlags, relayToGame],
  );

  const resetFlags = useCallback(() => {
    reset();
    publishDevToolkitSync({
      type: "setFlags",
      patch: DEFAULT_DEV_TOOLKIT_FLAGS,
    });
    if (relayToGame) {
      messenger?.sendGameEvent(
        DEV_TOOLKIT_BRIDGE_EVENTS.SET_FLAGS,
        DEFAULT_DEV_TOOLKIT_FLAGS,
      );
    }
  }, [messenger, relayToGame, reset]);

  return { flags, sendFlags, resetFlags };
}

export interface UseDevToolkitBridgeOptions {
  relayToGame?: boolean;
  /** When false, listeners are detached (background workspace). */
  enabled?: boolean;
  /** When this value changes, dev tools and workspace panes reset (e.g. template id). */
  resetKey?: string;
}

/** Attach game + broadcast listeners. Call once per window (Studio host or popout). */
export function useDevToolkitBridge(options?: UseDevToolkitBridgeOptions) {
  const enabled = options?.enabled ?? true;
  const relayToGame = (options?.relayToGame ?? true) && enabled;
  const resetKey = enabled ? options?.resetKey : undefined;
  const controls = useDevToolkitControls({ relayToGame });
  const { resetFlags } = controls;

  const messenger = useGameChromeOverlayStore((state) => state.messenger);
  const setFlags = useDevToolkitStore((state) => state.setFlags);
  const patchFlags = useDevToolkitStore((state) => state.patchFlags);
  useEffect(() => {
    if (!enabled || resetKey === undefined) {
      return;
    }
    resetFlags();
    useWorkspaceCenterStore.getState().reset();
  }, [enabled, resetKey, resetFlags]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin !== getGameEngineOrigin()) return;

      const data = event.data;
      if (
        typeof data !== "object" ||
        data === null ||
        (data as { type?: string }).type !== "GAME_EVENT"
      ) {
        return;
      }

      const record = data as { eventName?: string; data?: unknown };

      if (record.eventName === DEV_TOOLKIT_BRIDGE_EVENTS.STATE) {
        const next = parseDevToolkitFlags(record.data);
        if (next) {
          setFlags(next);
          publishDevToolkitSync({ type: "state", flags: next });
        }
        return;
      }

      if (record.eventName === DEV_TOOLKIT_BRIDGE_EVENTS.ASSET_PICKED) {
        const asset = parseDevToolkitPickedAsset(record.data);
        if (asset) {
          useWorkspaceCenterStore.getState().openAssetPane(asset, {
            activate: true,
          });
          if (asset.configBinding) {
            useEditorStore.getState().openAssetInspector(asset.configBinding);
          }
          publishDevToolkitSync({ type: "asset", asset });
        } else if (process.env.NODE_ENV === "development") {
          console.warn(
            "[DevToolkit] Ignored invalid ASSET_PICKED payload",
            record.data,
          );
        }
      }
    };

    window.addEventListener("message", onWindowMessage);
    return () => window.removeEventListener("message", onWindowMessage);
  }, [enabled, setFlags]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onSync = (message: DevToolkitSyncMessage) => {
      if (message.type === "state") {
        setFlags(message.flags);
        return;
      }

      if (message.type === "asset") {
        useWorkspaceCenterStore.getState().openAssetPane(message.asset, {
          activate: true,
        });
        if (message.asset.configBinding) {
          useEditorStore.getState().openAssetInspector(message.asset.configBinding);
        }
        return;
      }

      if (message.type === "setFlags") {
        patchFlags(message.patch);
        if (relayToGame) {
          messenger?.sendGameEvent(
            DEV_TOOLKIT_BRIDGE_EVENTS.SET_FLAGS,
            message.patch,
          );
        }
      }
    };

    return subscribeDevToolkitSync(onSync);
  }, [enabled, messenger, patchFlags, relayToGame, setFlags]);

  return controls;
}
