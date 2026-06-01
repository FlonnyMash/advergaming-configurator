import {
  DEFAULT_GAME_MASTER_CONFIG,
  type DOMOverlayConfig,
  type GameMasterConfig,
  type GameplayConfig,
  type ThemeConfig,
} from "@advergaming/shared";
import { create } from "zustand";

interface ConfigStore {
  config: GameMasterConfig;
  setTheme: (theme: Partial<ThemeConfig>) => void;
  setGameplay: (gameplay: Partial<GameplayConfig>) => void;
  setDomOverlay: (domOverlay: Partial<DOMOverlayConfig>) => void;
  resetConfig: () => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: DEFAULT_GAME_MASTER_CONFIG,

  setTheme: (theme) =>
    set((state) => ({
      config: {
        ...state.config,
        theme: { ...state.config.theme, ...theme },
      },
    })),

  setGameplay: (gameplay) =>
    set((state) => ({
      config: {
        ...state.config,
        gameplay: { ...state.config.gameplay, ...gameplay },
      },
    })),

  setDomOverlay: (domOverlay) =>
    set((state) => ({
      config: {
        ...state.config,
        domOverlay: { ...state.config.domOverlay, ...domOverlay },
      },
    })),

  resetConfig: () => set({ config: DEFAULT_GAME_MASTER_CONFIG }),
}));

export const selectConfig = (state: ConfigStore) => state.config;
