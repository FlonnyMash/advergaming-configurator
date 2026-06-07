"use client";

import { create } from "state";

type AssetLayoutSavedStore = {
  clearSavedLayouts: () => void;
};

export const useAssetLayoutSavedStore = create<AssetLayoutSavedStore>(() => ({
  clearSavedLayouts: () => {},
}));
