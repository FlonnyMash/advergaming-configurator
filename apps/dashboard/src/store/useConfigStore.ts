import {
  DEFAULT_GAME_MASTER_CONFIG,
  type DOMOverlayConfig,
  type GameMasterConfig,
  type GameplayConfig,
  type GameTemplateId,
  type ThemeConfig,
} from "@advergaming/shared";
import { create } from "zustand";

interface ConfigStore {
  config: GameMasterConfig;
  activeTemplate: GameTemplateId;
  setActiveTemplate: (id: GameTemplateId) => void;
  setTheme: (theme: Partial<ThemeConfig>) => void;
  setPlayerTexture: (playerTexture: string | null) => void;
  setGameplay: (gameplay: Partial<GameplayConfig>) => void;
  setDomOverlay: (domOverlay: Partial<DOMOverlayConfig>) => void;
  setConfig: (config: GameMasterConfig) => void;
  resetConfig: () => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: DEFAULT_GAME_MASTER_CONFIG,
  activeTemplate: "dice-poker",

  setActiveTemplate: (id) => set({ activeTemplate: id }),

  setTheme: (theme) =>
    set((state) => ({
      config: {
        ...state.config,
        theme: { ...state.config.theme, ...theme },
      },
    })),

  setPlayerTexture: (playerTexture) =>
    set((state) => ({
      config: {
        ...state.config,
        theme: { ...state.config.theme, playerTexture },
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

  setConfig: (config) => set({ config }),

  resetConfig: () => set({ config: DEFAULT_GAME_MASTER_CONFIG }),
}));

export const selectConfig = (state: ConfigStore) => state.config;
