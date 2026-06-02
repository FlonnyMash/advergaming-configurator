import {
  applyPath,
  assertPermission,
  buildConfigFromSchema,
  type BrandingSettings,
  type GameMasterConfig,
  type GameTemplateId,
  type SystemSettings,
} from "@advergaming/shared";
import { getStudioGameSchema } from "../registry/studioSchemaRegistry";
import { DEFAULT_GAME_TEMPLATE_ID } from "@advergaming/shared";
import { create } from "zustand";

const STUDIO_MODE = "studio" as const;

interface StudioConfigStore {
  config: GameMasterConfig;
  selectedTemplateId: GameTemplateId;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  setConfig: (config: GameMasterConfig) => void;
  setSystem: (system: Partial<SystemSettings>) => void;
  setBranding: (branding: Partial<BrandingSettings>) => void;
  patchBrandingPath: (path: string, value: unknown) => void;
  patchSystemPath: (path: string, value: unknown) => void;
  resetConfig: () => void;
}

export const useStudioConfigStore = create<StudioConfigStore>((set, get) => ({
  config: buildConfigFromSchema(getStudioGameSchema(DEFAULT_GAME_TEMPLATE_ID)),
  selectedTemplateId: DEFAULT_GAME_TEMPLATE_ID,

  setSelectedTemplateId: (id) => {
    assertPermission(STUDIO_MODE, "schema:system");
    set({
      selectedTemplateId: id,
      config: buildConfigFromSchema(getStudioGameSchema(id), id),
    });
  },

  setConfig: (config) => {
    assertPermission(STUDIO_MODE, "schema:system");
    set({ config });
  },

  setSystem: (system) =>
    set((state) => ({
      config: {
        ...state.config,
        system: { ...state.config.system, ...system },
      },
    })),

  setBranding: (branding) =>
    set((state) => ({
      config: {
        ...state.config,
        branding: { ...state.config.branding, ...branding },
      },
    })),

  patchBrandingPath: (path, value) =>
    set((state) => {
      const branding = structuredClone(
        state.config.branding,
      ) as unknown as Record<string, unknown>;
      applyPath(branding, path, value);
      return {
        config: {
          ...state.config,
          branding: branding as unknown as BrandingSettings,
        },
      };
    }),

  patchSystemPath: (path, value) =>
    set((state) => {
      const system = structuredClone(
        state.config.system,
      ) as unknown as Record<string, unknown>;
      applyPath(system, path, value);
      return {
        config: {
          ...state.config,
          system: system as unknown as SystemSettings,
        },
      };
    }),

  resetConfig: () => {
    const { selectedTemplateId } = get();
    set({
      config: buildConfigFromSchema(
        getStudioGameSchema(selectedTemplateId),
        selectedTemplateId,
      ),
    });
  },
}));

export const selectStudioConfig = (state: StudioConfigStore) => state.config;
