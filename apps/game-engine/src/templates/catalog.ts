import {
  gameSchemaFromManifest,
  parseTemplateManifest,
  resolvePhaserSceneKeys,
  type GameSchema,
  type GameTemplateId,
  type TemplateCatalogEntry,
} from "@mashedgames/shared";
import type { Types } from "phaser";
import {
  registerPhaserSceneMap,
} from "../game/scenes/PhaserSceneRegistry.ts";

export type AppEnvironment = "dev" | "prod";

interface TemplateModule {
  manifest: unknown;
  Scene: Types.Scenes.SceneType;
  phaserSceneMap?: Record<string, Types.Scenes.SceneType>;
}

const libraryModules = import.meta.glob<TemplateModule>("./library/*/index.ts", {
  eager: true,
});

const developmentModules = import.meta.glob<TemplateModule>(
  "./development/*/index.ts",
  {
    eager: true,
  },
);

function parseTemplatePath(path: string): {
  source: TemplateCatalogEntry["source"];
  folder: string;
} | null {
  const libraryMatch = /^\.\/library\/([^/]+)\/index\.ts$/.exec(path);
  if (libraryMatch) {
    return { source: "library", folder: libraryMatch[1]! };
  }
  const developmentMatch = /^\.\/development\/([^/]+)\/index\.ts$/.exec(path);
  if (developmentMatch) {
    return { source: "development", folder: developmentMatch[1]! };
  }
  return null;
}

function loadCatalogFromGlob(
  modules: Record<string, TemplateModule>,
  source: TemplateCatalogEntry["source"],
): TemplateCatalogEntry[] {
  const entries: TemplateCatalogEntry[] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const parsed = parseTemplatePath(path);
    if (!parsed || parsed.source !== source) continue;

    const manifest = parseTemplateManifest(mod.manifest);
    if (!manifest) {
      console.warn(`[catalog] Invalid manifest in ${path}`);
      continue;
    }
    if (manifest.id !== parsed.folder) {
      console.warn(
        `[catalog] Manifest id "${manifest.id}" does not match folder "${parsed.folder}"`,
      );
    }

    entries.push({ manifest, source });
  }

  return entries.sort((a, b) => a.manifest.label.localeCompare(b.manifest.label));
}

const libraryCatalog = loadCatalogFromGlob(
  libraryModules as Record<string, TemplateModule>,
  "library",
);
const developmentCatalog = loadCatalogFromGlob(
  developmentModules as Record<string, TemplateModule>,
  "development",
);

function mergeCatalogEntries(
  development: TemplateCatalogEntry[],
  library: TemplateCatalogEntry[],
): TemplateCatalogEntry[] {
  const byId = new Map<string, TemplateCatalogEntry>();
  for (const entry of development) {
    byId.set(entry.manifest.id, entry);
  }
  for (const entry of library) {
    byId.set(entry.manifest.id, entry);
  }
  return [...byId.values()].sort((a, b) =>
    a.manifest.label.localeCompare(b.manifest.label),
  );
}

/** All templates discovered at build time from library/ and development/. */
export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = mergeCatalogEntries(
  developmentCatalog,
  libraryCatalog,
);

export const TEMPLATE_CATALOG_IDS: GameTemplateId[] = TEMPLATE_CATALOG.map(
  (entry) => entry.manifest.id,
);

export function getCatalogEntries(
  env: AppEnvironment = "prod",
): TemplateCatalogEntry[] {
  if (env === "dev") {
    return TEMPLATE_CATALOG;
  }
  return libraryCatalog;
}

export function getCatalogEntry(
  templateId: GameTemplateId,
): TemplateCatalogEntry | undefined {
  return TEMPLATE_CATALOG.find((entry) => entry.manifest.id === templateId);
}

export function getGameSchemaFromCatalog(templateId: GameTemplateId): GameSchema {
  const entry = getCatalogEntry(templateId);
  if (!entry) {
    throw new Error(`Unknown template id: ${templateId}`);
  }
  return gameSchemaFromManifest(entry.manifest);
}

/** Scene classes keyed by template id (library + development). */
export function buildSceneRegistry(): Record<
  GameTemplateId,
  Types.Scenes.SceneType
> {
  const registry: Record<string, Types.Scenes.SceneType> = {};

  const allModules = {
    ...libraryModules,
    ...developmentModules,
  } as Record<string, TemplateModule>;

  for (const [path, mod] of Object.entries(allModules)) {
    const parsed = parseTemplatePath(path);
    const manifest = parseTemplateManifest(mod.manifest);
    if (!parsed || !manifest) continue;
    registry[manifest.id] = mod.Scene;
  }

  return registry;
}

/** Register all Phaser scene classes from template modules into PhaserSceneRegistry. */
export function buildPhaserSceneRegistry(): void {
  const allModules = {
    ...libraryModules,
    ...developmentModules,
  } as Record<string, TemplateModule>;

  for (const [path, mod] of Object.entries(allModules)) {
    const parsed = parseTemplatePath(path);
    const manifest = parseTemplateManifest(mod.manifest);
    if (!parsed || !manifest) continue;

    if (mod.phaserSceneMap && Object.keys(mod.phaserSceneMap).length > 0) {
      registerPhaserSceneMap(mod.phaserSceneMap);
      continue;
    }

    const keys = resolvePhaserSceneKeys(manifest);
    const primaryKey = keys[0] ?? manifest.id;
    registerPhaserSceneMap({ [primaryKey]: mod.Scene });
  }
}

buildPhaserSceneRegistry();
