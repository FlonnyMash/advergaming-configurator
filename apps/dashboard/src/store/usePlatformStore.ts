"use client";

import platformDefaults from "@/config/platform-config.json";
import {
  DEFAULT_PLATFORM_CONFIG,
  type PlatformConfig,
  type PlatformFeatures,
} from "@mashedgames/shared";
import { create } from "zustand";

type PlatformConfigPatch = Partial<Omit<PlatformConfig, "features">> & {
  features?: Partial<PlatformFeatures>;
};

const initialConfig: PlatformConfig = {
  ...DEFAULT_PLATFORM_CONFIG,
  ...platformDefaults,
  features: {
    ...DEFAULT_PLATFORM_CONFIG.features,
    ...platformDefaults.features,
  },
};

type PlatformStore = PlatformConfig & {
  updatePlatformConfig: (partial: PlatformConfigPatch) => void;
  resetPlatformConfig: () => void;
};

export const usePlatformStore = create<PlatformStore>((set) => ({
  ...initialConfig,
  updatePlatformConfig: (partial) =>
    set((state) => ({
      ...state,
      ...partial,
      features: partial.features
        ? { ...state.features, ...partial.features }
        : state.features,
    })),
  resetPlatformConfig: () => set({ ...initialConfig }),
}));
