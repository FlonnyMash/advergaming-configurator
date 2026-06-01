import {
  assertPermission,
  buildConfigWithFrozenSystem,
  exportClientPayload,
  mergeBrandingPatch,
  type BrandingPatch,
  type BrandingSettings,
  type GameMasterConfig,
  type GameTemplateId,
} from "@advergaming/shared";
import { DEFAULT_GAME_TEMPLATE_ID } from "@advergaming/shared";
import { create } from "zustand";
import {
  getConfiguratorGameSchema,
  getFrozenSystemDefaults,
  getProductionTemplateOptions,
} from "../registry/productionSchemaRegistry";

const CONFIGURATOR_MODE = "configurator" as const;

function firstProductionTemplateId(): GameTemplateId {
  const options = getProductionTemplateOptions();
  return options[0]?.id ?? DEFAULT_GAME_TEMPLATE_ID;
}

interface ConfiguratorStore {
  config: GameMasterConfig;
  selectedTemplateId: GameTemplateId;
  systemReadonly: boolean;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  patchBranding: (patch: BrandingPatch) => void;
  patchBrandingPath: (path: string, value: unknown) => void;
  exportClientPayload: () => Pick<GameMasterConfig, "meta" | "branding">;
  resetBranding: () => void;
}

function applyPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function buildConfiguratorConfig(templateId: GameTemplateId): GameMasterConfig {
  assertPermission(CONFIGURATOR_MODE, "schema:branding");
  const schema = getConfiguratorGameSchema(templateId);
  const systemDefaults = getFrozenSystemDefaults(templateId);
  return buildConfigWithFrozenSystem(schema, systemDefaults, templateId);
}

const initialTemplateId = firstProductionTemplateId();

export const useConfiguratorStore = create<ConfiguratorStore>((set, get) => ({
  config: buildConfiguratorConfig(initialTemplateId),
  selectedTemplateId: initialTemplateId,
  systemReadonly: true,

  setSelectedTemplateId: (id) => {
    assertPermission(CONFIGURATOR_MODE, "template:library");
    set({
      selectedTemplateId: id,
      config: buildConfiguratorConfig(id),
    });
  },

  patchBranding: (patch) =>
    set((state) => ({
      config: mergeBrandingPatch(state.config, patch),
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

  exportClientPayload: () => exportClientPayload(get().config),

  resetBranding: () => {
    const { selectedTemplateId } = get();
    set({ config: buildConfiguratorConfig(selectedTemplateId) });
  },
}));

export const selectConfiguratorConfig = (state: ConfiguratorStore) =>
  state.config;
