import {
  DEFAULT_GAME_CONFIG,
  exportClientPayload,
  patchFlatConfig,
  type GameConfig,
} from "@mashedgames/shared";
import { create } from "state";

export interface StudioConfigStore {
  config: GameConfig;
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  patchConfig: <K extends keyof GameConfig>(
    key: K,
    value: GameConfig[K],
  ) => void;
  resetConfig: () => void;
  exportConfig: () => GameConfig;
  hydrateConfig: (config: GameConfig) => void;
}

export const useStudioConfigStore = create<StudioConfigStore>((set, get) => ({
  config: { ...DEFAULT_GAME_CONFIG, appMode: "studio" },
  selectedTemplateId: DEFAULT_GAME_CONFIG.activeTemplateId,

  setSelectedTemplateId: (id) => {
    set({
      selectedTemplateId: id,
      config: { ...get().config, activeTemplateId: id },
    });
  },

  patchConfig: (key, value) => {
    set({ config: patchFlatConfig(get().config, key, value) });
  },

  resetConfig: () => {
    set({
      config: { ...DEFAULT_GAME_CONFIG, appMode: "studio" },
      selectedTemplateId: DEFAULT_GAME_CONFIG.activeTemplateId,
    });
  },

  exportConfig: () => exportClientPayload(get().config),

  hydrateConfig: (config) => {
    set({
      config: { ...config, appMode: "studio" },
      selectedTemplateId: config.activeTemplateId,
    });
  },
}));

export function selectStudioConfig(state: StudioConfigStore): GameConfig {
  return state.config;
}
