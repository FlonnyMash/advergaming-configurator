import {
  applyPath,
  assertPermission,
  buildConfigFromSchema,
  getConfigValue,
  type BrandingSettings,
  type ControlValue,
  type GameMasterConfig,
  type GameTemplateId,
  type SystemSettings,
} from "@mashedgames/shared";
import { getStudioGameSchema } from "../registry/studioSchemaRegistry";
import { DEFAULT_GAME_TEMPLATE_ID } from "@mashedgames/shared";
import {
  applyGameControlsSnapshot,
  captureGameControlsSnapshot,
  cloneGameMasterConfig,
  controlValuesEqual,
  findStudioControl,
  mergeGameControlsFromSaved,
  studioControlsForSchema,
  type GameControlsSnapshot,
} from "../lib/game-controls-state";
import { create } from "zustand";

const STUDIO_MODE = "studio" as const;
const MAX_CONTROL_HISTORY = 50;

const initialSchema = getStudioGameSchema(DEFAULT_GAME_TEMPLATE_ID);
const initialConfig = buildConfigFromSchema(initialSchema);

function studioControls(templateId: GameTemplateId) {
  return studioControlsForSchema(getStudioGameSchema(templateId));
}

function pushControlSnapshot(
  state: Pick<StudioConfigStore, "controlHistoryPast" | "config" | "selectedTemplateId">,
): Pick<StudioConfigStore, "controlHistoryPast" | "controlHistoryFuture"> {
  const controls = studioControls(state.selectedTemplateId);
  return {
    controlHistoryPast: [
      ...state.controlHistoryPast.slice(-(MAX_CONTROL_HISTORY - 1)),
      captureGameControlsSnapshot(state.config, controls),
    ],
    controlHistoryFuture: [],
  };
}

interface StudioConfigStore {
  config: GameMasterConfig;
  savedConfig: GameMasterConfig;
  controlHistoryPast: GameControlsSnapshot[];
  controlHistoryFuture: GameControlsSnapshot[];
  selectedTemplateId: GameTemplateId;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  setConfig: (config: GameMasterConfig) => void;
  setSystem: (system: Partial<SystemSettings>) => void;
  setBranding: (branding: Partial<BrandingSettings>) => void;
  patchBrandingPath: (path: string, value: unknown) => void;
  patchSystemPath: (path: string, value: unknown) => void;
  patchBrandingPathFromControls: (path: string, value: unknown) => void;
  patchSystemPathFromControls: (path: string, value: unknown) => void;
  revertGameControlsToSaved: () => void;
  undoGameControl: () => void;
  redoGameControl: () => void;
  markGameControlsSaved: () => void;
  resetConfig: () => void;
}

export const useStudioConfigStore = create<StudioConfigStore>((set, get) => ({
  config: initialConfig,
  savedConfig: cloneGameMasterConfig(initialConfig),
  controlHistoryPast: [],
  controlHistoryFuture: [],
  selectedTemplateId: DEFAULT_GAME_TEMPLATE_ID,

  setSelectedTemplateId: (id) => {
    assertPermission(STUDIO_MODE, "schema:system");
    const config = buildConfigFromSchema(getStudioGameSchema(id), id);
    set({
      selectedTemplateId: id,
      config,
      savedConfig: cloneGameMasterConfig(config),
      controlHistoryPast: [],
      controlHistoryFuture: [],
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

  patchBrandingPathFromControls: (path, value) =>
    set((state) => {
      const controls = studioControls(state.selectedTemplateId);
      const control = findStudioControl(controls, "branding", path);
      const nextValue = value as ControlValue;

      if (control && controlValuesEqual(getConfigValue(state.config, control), nextValue)) {
        return state;
      }

      const branding = structuredClone(
        state.config.branding,
      ) as unknown as Record<string, unknown>;
      applyPath(branding, path, value);
      return {
        ...pushControlSnapshot(state),
        config: {
          ...state.config,
          branding: branding as unknown as BrandingSettings,
        },
      };
    }),

  patchSystemPathFromControls: (path, value) =>
    set((state) => {
      const controls = studioControls(state.selectedTemplateId);
      const control = findStudioControl(controls, "system", path);
      const nextValue = value as ControlValue;

      if (control && controlValuesEqual(getConfigValue(state.config, control), nextValue)) {
        return state;
      }

      const system = structuredClone(
        state.config.system,
      ) as unknown as Record<string, unknown>;
      applyPath(system, path, value);
      return {
        ...pushControlSnapshot(state),
        config: {
          ...state.config,
          system: system as unknown as SystemSettings,
        },
      };
    }),

  revertGameControlsToSaved: () => {
    const state = get();
    const controls = studioControls(state.selectedTemplateId);
    set({
      config: mergeGameControlsFromSaved(
        state.config,
        state.savedConfig,
        controls,
      ),
      controlHistoryPast: [],
      controlHistoryFuture: [],
    });
  },

  undoGameControl: () => {
    const state = get();
    if (state.controlHistoryPast.length === 0) {
      return;
    }
    const controls = studioControls(state.selectedTemplateId);
    const previous = state.controlHistoryPast[state.controlHistoryPast.length - 1]!;
    const currentSnapshot = captureGameControlsSnapshot(state.config, controls);

    set({
      controlHistoryPast: state.controlHistoryPast.slice(0, -1),
      controlHistoryFuture: [currentSnapshot, ...state.controlHistoryFuture],
      config: applyGameControlsSnapshot(state.config, controls, previous),
    });
  },

  redoGameControl: () => {
    const state = get();
    if (state.controlHistoryFuture.length === 0) {
      return;
    }
    const controls = studioControls(state.selectedTemplateId);
    const next = state.controlHistoryFuture[0]!;
    const currentSnapshot = captureGameControlsSnapshot(state.config, controls);

    set({
      controlHistoryFuture: state.controlHistoryFuture.slice(1),
      controlHistoryPast: [...state.controlHistoryPast, currentSnapshot],
      config: applyGameControlsSnapshot(state.config, controls, next),
    });
  },

  markGameControlsSaved: () => {
    const { config } = get();
    set({
      savedConfig: cloneGameMasterConfig(config),
      controlHistoryPast: [],
      controlHistoryFuture: [],
    });
  },

  resetConfig: () => {
    const { selectedTemplateId } = get();
    const config = buildConfigFromSchema(
      getStudioGameSchema(selectedTemplateId),
      selectedTemplateId,
    );
    set({
      config,
      savedConfig: cloneGameMasterConfig(config),
      controlHistoryPast: [],
      controlHistoryFuture: [],
    });
  },
}));

export const selectStudioConfig = (state: StudioConfigStore) => state.config;
