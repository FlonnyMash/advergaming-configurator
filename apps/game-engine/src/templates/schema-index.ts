import type {
  AppMode,
  ControlFieldSchema,
  GameSchema,
  GameTemplateId,
  SystemSettings,
  TemplateCatalogEntry,
  TemplateManifest,
} from "@mashedgames/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
import {
  buildConfigFromSchema,
  DEFAULT_GAME_TEMPLATE_ID,
  gameSchemaFromManifest,
  getDesktopBundledTemplateIds,
  parseTemplateManifest,
} from "@mashedgames/shared";
import { ALL_MANIFESTS } from "./manifest-registry.generated";
import { PUBLISHED_SYSTEM_BY_ID } from "./published-system-registry.generated";

export type AppEnvironment = "dev" | "prod";

function entriesFromManifests(
  manifests: TemplateManifest[],
): TemplateCatalogEntry[] {
  const entries: TemplateCatalogEntry[] = [];

  for (const raw of manifests) {
    const manifest = parseTemplateManifest(raw);
    if (!manifest) {
      console.warn(`[schema-index] Invalid manifest skipped`);
      continue;
    }
    entries.push({ manifest });
  }

  return entries.sort((a, b) => a.manifest.label.localeCompare(b.manifest.label));
}

/** All templates from the unified templates/ directory. */
export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = entriesFromManifests(ALL_MANIFESTS);

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
  return TEMPLATE_CATALOG.filter((e) => e.manifest.status === "published");
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

function resolveFallbackTemplateId(): GameTemplateId | null {
  if (GAME_SCHEMA_REGISTRY[DEFAULT_GAME_TEMPLATE_ID]) {
    return DEFAULT_GAME_TEMPLATE_ID;
  }
  const firstId = Object.keys(GAME_SCHEMA_REGISTRY)[0];
  return (firstId as GameTemplateId | undefined) ?? null;
}

export function getGameSchema(templateId: GameTemplateId): GameSchema {
  const schema = GAME_SCHEMA_REGISTRY[templateId];
  if (schema) {
    return schema;
  }

  const fallbackId = resolveFallbackTemplateId();
  if (!fallbackId) {
    throw new Error("[schema-index] No templates available in GAME_SCHEMA_REGISTRY");
  }

  console.warn(
    `[schema-index] Unknown template id "${templateId}". Falling back to "${fallbackId}".`,
  );
  return GAME_SCHEMA_REGISTRY[fallbackId]!;
}

export interface TemplatePickerOption {
  id: GameTemplateId;
  label: string;
  description?: string;
  previewUrl: string;
  version: string;
  author: string;
  status: TemplateCatalogEntry["manifest"]["status"];
}

export function getPublishedSystemDefaults(
  templateId: GameTemplateId,
): SystemSettings {
  const baked = PUBLISHED_SYSTEM_BY_ID[templateId];
  if (baked) {
    const frozen: SystemSettings = structuredClone(baked);
    if (isRecord(frozen.physics)) {
      frozen.physics = { ...frozen.physics, debugDraw: false };
    }
    return frozen;
  }

  const schema = getGameSchema(templateId);
  const config = buildConfigFromSchema(schema, schema.id);
  const frozen: SystemSettings = structuredClone(
    config as Record<string, unknown>,
  );
  if (isRecord(frozen.physics)) {
    frozen.physics = {
      ...frozen.physics,
      debugDraw: false,
    };
  }
  return frozen;
}

export function getCatalogEntriesForMode(
  appMode: AppMode,
  env: AppEnvironment = "prod",
): TemplateCatalogEntry[] {
  const entries = getCatalogEntries(env);
  if (appMode === "studio") {
    return entries;
  }
  return entries.filter((e) => e.manifest.status === "published");
}

function filterDesktopBundledTemplates(
  options: TemplatePickerOption[],
): TemplatePickerOption[] {
  const bundled = getDesktopBundledTemplateIds();
  if (!bundled) {
    return options;
  }
  const allowed = new Set(bundled);
  return options.filter((option) => allowed.has(option.id));
}

export function getTemplatePickerOptions(
  env: AppEnvironment = "dev",
): TemplatePickerOption[] {
  const options = getAvailableTemplates(env).map((entry) => ({
    id: entry.manifest.id,
    label: entry.manifest.label,
    description: entry.manifest.description,
    previewUrl: entry.manifest.previewUrl,
    version: entry.manifest.version,
    author: entry.manifest.author,
    status: entry.manifest.status,
  }));
  return filterDesktopBundledTemplates(options);
}

/** @deprecated Use getTemplatePickerOptions */
export const GAME_TEMPLATES: { id: GameTemplateId; label: string }[] =
  getTemplatePickerOptions("dev").map((t) => ({ id: t.id, label: t.label }));

export type { TemplateCatalogEntry } from "@mashedgames/shared";
export { DEFAULT_GAME_TEMPLATE_ID };
