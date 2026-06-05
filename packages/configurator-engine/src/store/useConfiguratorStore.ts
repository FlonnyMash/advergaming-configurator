import {
  applyPath,
  assertPermission,
  buildConfigWithFrozenSystem,
  ClientProjectPayloadSchema,
  exportClientPayload,
  enrichClientMeta,
  type ClientProjectPayload,
  type ControlFieldSchema,
  type GameConfig,
  type GameProjectManifest,
  type GameTemplateId,
} from "@mashedgames/shared";
import { DEFAULT_GAME_TEMPLATE_ID } from "@mashedgames/shared";
import { create } from "state";
import {
  getConfiguratorGameSchema,
  getFrozenSystemDefaults,
  getProductionTemplateOptions,
} from "../registry/productionSchemaRegistry";

const CONFIGURATOR_MODE = "configurator" as const;

export type AssetSaveInput = {
  projectId: string;
  file: File;
  targetPath: string;
};

export type AssetSaveResult = {
  relativePath: string;
  absolutePath: string;
  textureKey?: string | null;
  manifest?: GameProjectManifest;
};

export type AssetSaveHandler = (input: AssetSaveInput) => Promise<AssetSaveResult>;

function firstProductionTemplateId(): GameTemplateId {
  const options = getProductionTemplateOptions();
  return options[0]?.id ?? DEFAULT_GAME_TEMPLATE_ID;
}

export interface ConfiguratorStore {
  config: GameConfig;
  selectedTemplateId: GameTemplateId;
  systemReadonly: boolean;
  projectId: string | null;
  projectManifest: GameProjectManifest | null;
  savedClient: ClientProjectPayload | null;
  projectMode: boolean;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  patchConfigPath: (path: string, value: unknown) => void;
  patchBrandingPath: (path: string, value: unknown) => void;
  exportClientPayload: () => ClientProjectPayload;
  resetBranding: () => void;
  hydrateProject: (input: {
    manifest: GameProjectManifest;
    config: GameConfig;
    client: ClientProjectPayload;
  }) => void;
  clearProject: () => void;
  markClientSaved: () => void;
  updateProjectManifest: (manifest: GameProjectManifest) => void;
  hasUnsavedClient: () => boolean;
  assetSaveHandler: AssetSaveHandler | null;
  setAssetSaveHandler: (handler: AssetSaveHandler | null) => void;
  uploadBrandingAsset: (
    file: File,
    control: ControlFieldSchema,
  ) => Promise<void>;
}

function buildConfiguratorConfig(templateId: GameTemplateId): GameConfig {
  assertPermission(CONFIGURATOR_MODE, "schema:branding");
  const schema = getConfiguratorGameSchema(templateId);
  const systemDefaults = getFrozenSystemDefaults(templateId);
  return buildConfigWithFrozenSystem(schema, systemDefaults, templateId);
}

const initialTemplateId = firstProductionTemplateId();

function sanitizeConfigForPersist(config: GameConfig): GameConfig {
  const next = structuredClone(config) as Record<string, unknown>;
  if (next.logoUrl === "") next.logoUrl = null;
  const catchGame = next.catchGame;
  if (typeof catchGame === "object" && catchGame !== null) {
    const assets = (catchGame as Record<string, unknown>).assets;
    if (typeof assets === "object" && assets !== null) {
      const player = (assets as Record<string, unknown>).player;
      if (player === "") {
        (assets as Record<string, unknown>).player = null;
      }
    }
  }
  return next as GameConfig;
}

function buildPersistedClientPayload(
  config: GameConfig,
  manifest: GameProjectManifest | null,
): ClientProjectPayload {
  const payload = exportClientPayload(config);
  const raw: ClientProjectPayload = manifest
    ? enrichClientMeta(payload, {
        projectId: manifest.projectId,
        parentTemplateId: manifest.parentTemplateId,
        parentPinnedVersion:
          payload.parentPinnedVersion ?? manifest.parentVersion,
      })
    : payload;

  const sanitized = sanitizeConfigForPersist(raw);
  const parsed = ClientProjectPayloadSchema.safeParse(sanitized);
  return parsed.success ? parsed.data : sanitized;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as object)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (val as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return val;
  });
}

function clientPayloadEquals(
  a: ClientProjectPayload,
  b: ClientProjectPayload,
): boolean {
  return stableStringify(a) === stableStringify(b);
}

export const useConfiguratorStore = create<ConfiguratorStore>((set, get) => ({
  config: buildConfiguratorConfig(initialTemplateId),
  selectedTemplateId: initialTemplateId,
  systemReadonly: true,
  projectId: null,
  projectManifest: null,
  savedClient: null,
  projectMode: false,
  assetSaveHandler: null,

  setAssetSaveHandler: (handler) => set({ assetSaveHandler: handler }),

  uploadBrandingAsset: async (file, control) => {
    const { projectId, assetSaveHandler } = get();
    if (!projectId) {
      throw new Error("No project loaded.");
    }
    if (!assetSaveHandler) {
      throw new Error("Asset save handler is not registered.");
    }

    const result = await assetSaveHandler({
      projectId,
      file,
      targetPath: control.targetPath,
    });

    get().patchConfigPath(control.targetPath, result.relativePath);
    if (result.manifest) {
      get().updateProjectManifest(result.manifest);
    }
  },

  setSelectedTemplateId: (id) => {
    if (get().projectMode) {
      return;
    }
    assertPermission(CONFIGURATOR_MODE, "template:library");
    set({
      selectedTemplateId: id,
      config: buildConfiguratorConfig(id),
      savedClient: null,
    });
  },

  patchConfigPath: (path, value) =>
    set((state) => {
      const next = structuredClone(state.config) as Record<string, unknown>;
      applyPath(next, path, value);
      return { config: next as GameConfig };
    }),

  patchBrandingPath: (path, value) => get().patchConfigPath(path, value),

  exportClientPayload: () =>
    buildPersistedClientPayload(get().config, get().projectManifest),

  resetBranding: () => {
    const { selectedTemplateId, projectMode, projectManifest } = get();
    if (projectMode && projectManifest) {
      set({
        config: buildConfiguratorConfig(projectManifest.parentTemplateId),
      });
      return;
    }
    set({ config: buildConfiguratorConfig(selectedTemplateId) });
  },

  hydrateProject: ({ manifest, config, client }) => {
    set({
      projectId: manifest.projectId,
      projectManifest: manifest,
      selectedTemplateId: manifest.parentTemplateId,
      config,
      savedClient: client,
      projectMode: true,
      systemReadonly: true,
    });
    set({
      savedClient: buildPersistedClientPayload(get().config, manifest),
    });
  },

  clearProject: () => {
    const id = firstProductionTemplateId();
    set({
      projectId: null,
      projectManifest: null,
      savedClient: null,
      projectMode: false,
      selectedTemplateId: id,
      config: buildConfiguratorConfig(id),
    });
  },

  markClientSaved: () => {
    set({
      savedClient: buildPersistedClientPayload(
        get().config,
        get().projectManifest,
      ),
    });
  },

  updateProjectManifest: (manifest) => {
    set({ projectManifest: manifest });
  },

  hasUnsavedClient: () => {
    const { savedClient, projectMode } = get();
    if (!projectMode || !savedClient) {
      return false;
    }
    const current = buildPersistedClientPayload(
      get().config,
      get().projectManifest,
    );
    return !clientPayloadEquals(savedClient, current);
  },
}));

export const selectConfiguratorConfig = (state: ConfiguratorStore) =>
  state.config;
