import {
  assertPermission,
  filterSchemaByMode,
  gameSchemaFromManifestForMode,
  type AppMode,
  type GameSchema,
  type GameTemplateId,
  type SystemSettings,
} from "@mashedgames/shared";
import {
  getCatalogEntries,
  getCatalogEntry,
  getGameSchema,
  getTemplatePickerOptions,
  type TemplatePickerOption,
} from "@mashedgames/game-engine/templates/schemas";
import { loadPublishedSystemDefaults } from "./publishedSystem";

const CONFIGURATOR_MODE: AppMode = "configurator";

export function getProductionTemplateOptions(): TemplatePickerOption[] {
  assertPermission(CONFIGURATOR_MODE, "template:library");
  return getTemplatePickerOptions("prod").filter(
    (t) => t.status === "production",
  );
}

export function getConfiguratorGameSchema(templateId: GameTemplateId): GameSchema {
  assertPermission(CONFIGURATOR_MODE, "schema:branding");
  const schema = getGameSchema(templateId);
  return filterSchemaByMode(schema, CONFIGURATOR_MODE);
}

export function getFrozenSystemDefaults(
  templateId: GameTemplateId,
): SystemSettings {
  return loadPublishedSystemDefaults(templateId);
}

export function getProductionCatalogEntry(templateId: GameTemplateId) {
  const entry = getCatalogEntry(templateId);
  if (!entry || entry.manifest.status !== "production") return undefined;
  return entry;
}

export { gameSchemaFromManifestForMode, getCatalogEntries };
