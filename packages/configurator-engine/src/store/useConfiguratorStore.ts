import {
  assertPermission,
  buildConfigWithFrozenSystem,
  ClientProjectPayloadSchema,
  exportClientPayload,
  enrichClientMeta,
  mergeBrandingPatch,
  type BrandingPatch,
  type BrandingSettings,
  type ClientProjectPayload,
  type ControlFieldSchema,
  type GameMasterConfig,
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
  config: GameMasterConfig;
  selectedTemplateId: GameTemplateId;
  systemReadonly: boolean;
  projectId: string | null;
  projectManifest: GameProjectManifest | null;
  savedClient: ClientProjectPayload | null;
  projectMode: boolean;
  setSelectedTemplateId: (id: GameTemplateId) => void;
  patchBranding: (patch: BrandingPatch) => void;
  patchBrandingPath: (path: string, value: unknown) => void;
  exportClientPayload: () => Pick<GameMasterConfig, "meta" | "branding">;
  resetBranding: () => void;
  hydrateProject: (input: {
    manifest: GameProjectManifest;
    config: GameMasterConfig;
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

function sanitizeBrandingForPersist(
  branding: BrandingSettings,
): BrandingSettings {
  const next = structuredClone(branding);
  if (next.theme.logoTexture === "") {
    next.theme.logoTexture = null;
  }
  if (next.theme.playerTexture === "") {
    next.theme.playerTexture = null;
  }
  return next;
}

function buildPersistedClientPayload(
  config: GameMasterConfig,
  manifest: GameProjectManifest | null,
): ClientProjectPayload {
  const payload = exportClientPayload(config);
  const raw: ClientProjectPayload = manifest
    ? {
        meta: enrichClientMeta(payload.meta, {
          projectId: manifest.projectId,
          parentTemplateId: manifest.parentTemplateId,
          parentPinnedVersion:
            payload.meta.parentPinnedVersion ?? manifest.parentVersion,
        }),
        branding: sanitizeBrandingForPersist(payload.branding),
      }
    : {
        meta: payload.meta,
        branding: sanitizeBrandingForPersist(payload.branding),
      };

  const parsed = ClientProjectPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : raw;
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

    get().patchBrandingPath(control.targetPath, result.relativePath);
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
