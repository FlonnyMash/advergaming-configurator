import type {
  AppMode,
  ControlFieldSchema,
  GameSchema,
  GameTemplateId,
  SystemSettings,
  TemplateCatalogEntry,
  TemplateManifest,
} from "@advergaming/shared";
import {
  buildConfigFromSchema,
  DEFAULT_GAME_TEMPLATE_ID,
  gameSchemaFromManifest,
  parseTemplateManifest,
} from "@advergaming/shared";
import {
  DEVELOPMENT_MANIFESTS,
  LIBRARY_MANIFESTS,
} from "./manifest-registry.generated";
import { PUBLISHED_SYSTEM_BY_ID } from "./published-system-registry.generated";

export type AppEnvironment = "dev" | "prod";

function entriesFromManifests(
  manifests: TemplateManifest[],
  source: TemplateCatalogEntry["source"],
): TemplateCatalogEntry[] {
  const entries: TemplateCatalogEntry[] = [];

  for (const raw of manifests) {
    const manifest = parseTemplateManifest(raw);
    if (!manifest) {
      console.warn(`[schema-index] Invalid manifest for source ${source}`);
      continue;
    }
    entries.push({ manifest, source });
  }

  return entries.sort((a, b) => a.manifest.label.localeCompare(b.manifest.label));
}

const libraryCatalog = entriesFromManifests(LIBRARY_MANIFESTS, "library");
const developmentCatalog = entriesFromManifests(
  DEVELOPMENT_MANIFESTS,
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

export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = mergeCatalogEntries(
  developmentCatalog,
  libraryCatalog,
);

export const TEMPLATE_CATALOG_IDS: GameTemplateId[] = TEMPLATE_CATALOG.map(
  (entry) => entry.manifest.id,
);

export function getAppEnvironmentFromProcess(
  envValue: string | undefined,
): AppEnvironment {
  return envValue === "prod" ? "prod" : "dev";
}

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

export function getAvailableTemplates(
  env: AppEnvironment = "dev",
): TemplateCatalogEntry[] {
  return getCatalogEntries(env);
}

export const GAME_SCHEMA_REGISTRY: Record<string, GameSchema> =
  Object.fromEntries(
    TEMPLATE_CATALOG.map((entry) => [
      entry.manifest.id,
      gameSchemaFromManifest(entry.manifest),
    ]),
  );

export const GAME_SCHEMAS: Record<string, ControlFieldSchema[]> =
  Object.fromEntries(
    Object.entries(GAME_SCHEMA_REGISTRY).map(([id, schema]) => [
      id,
      schema.controls,
    ]),
  );

export function getGameSchema(templateId: GameTemplateId): GameSchema {
  const schema = GAME_SCHEMA_REGISTRY[templateId];
  if (!schema) {
    throw new Error(`Unknown template id: ${templateId}`);
  }
  return schema;
}

export interface TemplatePickerOption {
  id: GameTemplateId;
  label: string;
  description?: string;
  previewUrl: string;
  version: string;
  author: string;
  status: TemplateCatalogEntry["manifest"]["status"];
  source: TemplateCatalogEntry["source"];
}

export function getPublishedSystemDefaults(
  templateId: GameTemplateId,
): SystemSettings {
  const baked = PUBLISHED_SYSTEM_BY_ID[templateId];
  if (baked) {
    const frozen = structuredClone(baked);
    frozen.physics.debugDraw = false;
    return frozen;
  }

  const schema = getGameSchema(templateId);
  const config = buildConfigFromSchema(schema, templateId);
  const system = structuredClone(config.system);
  system.physics.debugDraw = false;
  return system;
}

export function getCatalogEntriesForMode(
  appMode: AppMode,
  env: AppEnvironment = "prod",
): TemplateCatalogEntry[] {
  const entries = getCatalogEntries(env);
  if (appMode === "studio") {
    return entries;
  }
  return entries.filter((e) => e.manifest.status === "production");
}

export function getTemplatePickerOptions(
  env: AppEnvironment = "dev",
): TemplatePickerOption[] {
  return getAvailableTemplates(env).map((entry) => ({
    id: entry.manifest.id,
    label: entry.manifest.label,
    description: entry.manifest.description,
    previewUrl: entry.manifest.previewUrl,
    version: entry.manifest.version,
    author: entry.manifest.author,
    status: entry.manifest.status,
    source: entry.source,
  }));
}

/** @deprecated Use getTemplatePickerOptions */
export const GAME_TEMPLATES: { id: GameTemplateId; label: string }[] =
  getTemplatePickerOptions("dev").map((t) => ({ id: t.id, label: t.label }));

export type { TemplateCatalogEntry } from "@advergaming/shared";
export { DEFAULT_GAME_TEMPLATE_ID };
