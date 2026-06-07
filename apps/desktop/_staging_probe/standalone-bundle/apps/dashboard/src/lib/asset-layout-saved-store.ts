"use client";

import type { DevToolkitAssetConfigBinding, DevToolkitAssetLayout } from "@mashedgames/shared";
import { create } from "state";

export function assetBindingKey(binding: DevToolkitAssetConfigBinding): string {
  return `${binding.itemKind}:${binding.itemIndex ?? ""}`;
}

type AssetLayoutSavedStore = {
  savedLayouts: Record<string, DevToolkitAssetLayout>;
  setSavedLayout: (key: string, layout: DevToolkitAssetLayout) => void;
  clearSavedLayouts: () => void;
  clearBinding: (key: string) => void;
};

export const useAssetLayoutSavedStore = create<AssetLayoutSavedStore>((set) => ({
  savedLayouts: {},
  setSavedLayout: (key, layout) =>
    set((state) => ({
      savedLayouts: {
        ...state.savedLayouts,
        [key]: structuredClone(layout),
      },
    })),
  clearSavedLayouts: () => set({ savedLayouts: {} }),
  clearBinding: (key) =>
    set((state) => {
      const savedLayouts = { ...state.savedLayouts };
      delete savedLayouts[key];
      return { savedLayouts };
    }),
}));
