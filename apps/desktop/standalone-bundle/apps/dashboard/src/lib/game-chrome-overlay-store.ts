"use client";

import {
  GAME_CHROME_BRIDGE_EVENTS,
  type GameChromeOverlayDescriptor,
} from "@mashedgames/shared";
import { create } from "state";

type OverlayMessenger = {
  sendGameEvent: (eventName: string, data: unknown) => void;
};

type GameChromeOverlayStore = {
  overlays: GameChromeOverlayDescriptor[];
  messenger: OverlayMessenger | null;
  setMessenger: (messenger: OverlayMessenger | null) => void;
  setRegistry: (overlays: GameChromeOverlayDescriptor[]) => void;
  clearRegistry: () => void;
  setOverlayUserVisible: (id: string, visible: boolean) => void;
};

export const useGameChromeOverlayStore = create<GameChromeOverlayStore>(
  (set, get) => ({
    overlays: [],
    messenger: null,
    setMessenger: (messenger) => set({ messenger }),
    setRegistry: (overlays) => set({ overlays }),
    clearRegistry: () => set({ overlays: [] }),
    setOverlayUserVisible: (id, visible) => {
      const { messenger } = get();
      messenger?.sendGameEvent(
        GAME_CHROME_BRIDGE_EVENTS.SET_OVERLAY_VISIBILITY,
        { id, visible },
      );
      set({
        overlays: get().overlays.map((overlay) =>
          overlay.id === id
            ? {
                ...overlay,
                userVisible: visible,
                visible: overlay.available && visible,
              }
            : overlay,
        ),
      });
    },
  }),
);
