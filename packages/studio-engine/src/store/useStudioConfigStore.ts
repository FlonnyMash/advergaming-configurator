import {
  applyPath,
  assertPermission,
  buildConfigFromSchema,
  getConfigValue,
  type ControlValue,
  type GameConfig,
  type GameTemplateId,
} from "@mashedgames/shared";
import { getStudioGameSchema } from "../registry/studioSchemaRegistry";
import { DEFAULT_GAME_TEMPLATE_ID } from "@mashedgames/shared";
import {
  applyGameControlsSnapshot,
  captureGameControlsSnapshot,
  cloneGameConfig,
  controlValuesEqual,
  findStudioControl,
  mergeGameControlsFromSaved,
  studioControlsForSchema,
  type GameControlsSnapshot,
} from "../lib/game-controls-state";
import { create } from "state";

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

function patchFlatPath(config: GameConfig, path: string, value: unknown): GameConfig {
  const next = cloneGameConfig(config);
  applyPath(next as Record<string, unknown>, path, value);
  if (path === "theme.primaryColor" && typeof value === "string") {
    next.themeColor = value;
  }
  return next;
}

interface StudioConfigStore {
  config: GameConfig;
  savedConfig: GameConfig;
  controlHistoryPast: GameControlsSnapshot[];
  controlHistoryFuture: GameControlsSnapshot[];
  selectedTemplateId: GameTemplateId;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  setConfig: (config: GameConfig) => void;
  patchConfigPath: (path: string, value: unknown) => void;
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
  savedConfig: cloneGameConfig(initialConfig),
  controlHistoryPast: [],
  controlHistoryFuture: [],
  selectedTemplateId: DEFAULT_GAME_TEMPLATE_ID,

  setSelectedTemplateId: (id) => {
    assertPermission(STUDIO_MODE, "schema:system");
    const config = buildConfigFromSchema(getStudioGameSchema(id), id);
    set({
      selectedTemplateId: id,
      config,
      savedConfig: cloneGameConfig(config),
      controlHistoryPast: [],
      controlHistoryFuture: [],
    });
  },

  setConfig: (config) => {
    assertPermission(STUDIO_MODE, "schema:system");
    set({ config });
  },

  patchConfigPath: (path, value) =>
    set((state) => ({ config: patchFlatPath(state.config, path, value) })),

  patchBrandingPath: (path, value) =>
    set((state) => ({ config: patchFlatPath(state.config, path, value) })),

  patchSystemPath: (path, value) =>
    set((state) => ({ config: patchFlatPath(state.config, path, value) })),

  patchBrandingPathFromControls: (path, value) =>
    set((state) => {
      const controls = studioControls(state.selectedTemplateId);
      const control = findStudioControl(controls, "branding", path);
      const nextValue = value as ControlValue;

      if (control && controlValuesEqual(getConfigValue(state.config, control), nextValue)) {
        return state;
      }

      return {
        ...pushControlSnapshot(state),
        config: patchFlatPath(state.config, path, value),
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

      return {
        ...pushControlSnapshot(state),
        config: patchFlatPath(state.config, path, value),
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
      savedConfig: cloneGameConfig(config),
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
      savedConfig: cloneGameConfig(config),
      controlHistoryPast: [],
      controlHistoryFuture: [],
    });
  },
}));

export const selectStudioConfig = (state: StudioConfigStore) => state.config;
