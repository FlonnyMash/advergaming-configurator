import type { GameSchema, GameTemplateId } from "@mashedgames/shared";
import { gameSchemaFromManifest } from "@mashedgames/shared";
import type { Types } from "phaser";
import {
  buildSceneRegistry,
  getCatalogEntries,
  TEMPLATE_CATALOG,
  type AppEnvironment,
} from "./catalog.ts";

export type { AppEnvironment } from "./catalog.ts";
export type { TemplateCatalogEntry } from "@mashedgames/shared";
export {
  getCatalogEntries,
  getCatalogEntry,
  TEMPLATE_CATALOG,
  TEMPLATE_CATALOG_IDS,
} from "./catalog.ts";

export interface TemplateDefinition {
  schema: GameSchema;
  Scene: Types.Scenes.SceneType;
}

const sceneRegistry = buildSceneRegistry();

/** Runtime registry: all templates from the unified templates/ directory. */
export const TemplateRegistry: Record<string, TemplateDefinition> =
  Object.fromEntries(
    TEMPLATE_CATALOG.map((entry) => [
      entry.manifest.id,
      {
        schema: gameSchemaFromManifest(entry.manifest),
        Scene: sceneRegistry[entry.manifest.id]!,
      },
    ]),
  );

export function getTemplateDefinition(id: GameTemplateId): TemplateDefinition {
  const definition = TemplateRegistry[id];
  if (!definition) {
    throw new Error(`Template not registered: ${id}`);
  }
  return definition;
}

export function isRegisteredTemplate(id: string): id is GameTemplateId {
  return id in TemplateRegistry;
}

/** Customer-facing templates for the dashboard (filtered by environment). */
export function getCustomerTemplateCatalog(env: AppEnvironment = "prod") {
  return getCatalogEntries(env);
}
