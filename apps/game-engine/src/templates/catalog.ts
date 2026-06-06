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

const templateModules = import.meta.glob<TemplateModule>("./*/index.ts", {
  eager: true,
});

function parseTemplatePath(
  path: string,
): { folder: string } | null {
  const match = /^\.\/([^/]+)\/index\.ts$/.exec(path);
  if (!match) return null;
  return { folder: match[1]! };
}

function loadCatalogFromGlob(
  modules: Record<string, TemplateModule>,
): TemplateCatalogEntry[] {
  const entries: TemplateCatalogEntry[] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const parsed = parseTemplatePath(path);
    if (!parsed) continue;

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

    entries.push({ manifest });
  }

  return entries.sort((a, b) => a.manifest.label.localeCompare(b.manifest.label));
}

/** All templates discovered at build time from the unified templates/ directory. */
export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = loadCatalogFromGlob(
  templateModules as Record<string, TemplateModule>,
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
  return TEMPLATE_CATALOG.filter((e) => e.manifest.status === "published");
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

/** Scene classes keyed by template id. */
export function buildSceneRegistry(): Record<
  GameTemplateId,
  Types.Scenes.SceneType
> {
  const registry: Record<string, Types.Scenes.SceneType> = {};

  for (const [path, mod] of Object.entries(
    templateModules as Record<string, TemplateModule>,
  )) {
    const parsed = parseTemplatePath(path);
    const manifest = parseTemplateManifest(mod.manifest);
    if (!parsed || !manifest) continue;
    registry[manifest.id] = mod.Scene;
  }

  return registry;
}

/** Register all Phaser scene classes from template modules into PhaserSceneRegistry. */
export function buildPhaserSceneRegistry(): void {
  for (const [path, mod] of Object.entries(
    templateModules as Record<string, TemplateModule>,
  )) {
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
