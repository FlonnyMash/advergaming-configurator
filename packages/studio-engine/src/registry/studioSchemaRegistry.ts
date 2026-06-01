import {
  assertPermission,
  filterSchemaByMode,
  gameSchemaFromManifestForMode,
  type AppMode,
  type GameSchema,
  type GameTemplateId,
} from "@advergaming/shared";
import {
  getCatalogEntries,
  getGameSchema,
  getTemplatePickerOptions,
  type AppEnvironment,
  type TemplatePickerOption,
} from "@advergaming/game-engine/templates/schemas";

const STUDIO_MODE: AppMode = "studio";

export function getStudioTemplateOptions(
  env: AppEnvironment = "dev",
): TemplatePickerOption[] {
  assertPermission(STUDIO_MODE, "template:library");
  return getTemplatePickerOptions(env);
}

export function getStudioGameSchema(templateId: GameTemplateId): GameSchema {
  assertPermission(STUDIO_MODE, "schema:system");
  const schema = getGameSchema(templateId);
  return filterSchemaByMode(schema, STUDIO_MODE);
}

export function getStudioCatalogEntries(env: AppEnvironment = "dev") {
  assertPermission(STUDIO_MODE, "template:development");
  return getCatalogEntries(env);
}

export { gameSchemaFromManifestForMode };
