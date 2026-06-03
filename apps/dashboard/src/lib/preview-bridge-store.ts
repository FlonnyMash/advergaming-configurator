"use client";

import { createDashboardMessenger } from "@/bridge/messenger";
import { create } from "zustand";

type PreviewMessenger = ReturnType<typeof createDashboardMessenger>;

type PreviewBridgeStore = {
  messenger: PreviewMessenger | null;
  runtimeAssets: Record<string, string>;
  setMessenger: (messenger: PreviewMessenger | null) => void;
  setRuntimeAssets: (assets: Record<string, string>) => void;
};

export const usePreviewBridgeStore = create<PreviewBridgeStore>((set) => ({
  messenger: null,
  runtimeAssets: {},
  setMessenger: (messenger) => set({ messenger }),
  setRuntimeAssets: (runtimeAssets) => set({ runtimeAssets }),
}));

export function pushRuntimeAssetsToPreview(): void {
  const { messenger, runtimeAssets } = usePreviewBridgeStore.getState();
  if (!messenger || Object.keys(runtimeAssets).length === 0) {
    return;
  }
  messenger.sendRuntimeAssets(runtimeAssets);
}
