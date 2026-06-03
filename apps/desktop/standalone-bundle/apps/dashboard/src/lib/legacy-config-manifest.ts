import type { TemplateConfigJsonSchema, TemplateManifest } from "@mashedgames/shared";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeScaffoldManifest } from "@/lib/template-import-normalize";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function addPrimitiveControl(
  target: Record<string, TemplateConfigJsonSchema>,
  key: string,
  value: unknown,
  targetCategory: "system" | "branding",
  pathPrefix: string,
): void {
  if (typeof value === "boolean") {
    target[key] = {
      type: "boolean",
      default: value,
      "x-control": {
        type: "toggle",
        label: humanizeKey(key),
        targetCategory,
        targetPath: `${pathPrefix}.${key}`,
        surface: "studio",
      },
    };
    return;
  }

  if (typeof value === "number") {
    const isMs = key.toLowerCase().includes("ms");
    const isSeconds = key.toLowerCase().includes("seconds");
    target[key] = {
      type: "number",
      default: value,
      minimum: isSeconds ? 5 : 0,
      maximum: isMs ? 10000 : isSeconds ? 600 : 1000,
      "x-control": {
        type: "slider",
        label: humanizeKey(key),
        targetCategory,
        targetPath: `${pathPrefix}.${key}`,
        surface: "studio",
        step: isMs ? 50 : 1,
      },
    };
    return;
  }

  if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)) {
    target[key] = {
      type: "string",
      default: value,
      "x-control": {
        type: "color",
        label: humanizeKey(key),
        targetCategory,
        targetPath: `${pathPrefix}.${key}`,
        surface: "both",
      },
    };
  }
}

function schemaFromLegacyAssets(
  assets: Record<string, unknown>,
  pathPrefix: string,
): TemplateConfigJsonSchema {
  const properties: Record<string, TemplateConfigJsonSchema> = {};

  if (typeof assets.player === "string") {
    properties.player = {
      type: "string",
      default: assets.player,
      "x-control": {
        type: "image",
        label: "Player sprite sheet",
        targetCategory: "branding",
        targetPath: `${pathPrefix}.player`,
        surface: "studio",
      },
    };
  }

  const ground = assets.ground;
  if (isRecord(ground) && typeof ground.image === "string") {
    properties.ground = {
      type: "object",
      properties: {
        image: {
          type: "string",
          default: ground.image,
          "x-control": {
            type: "image",
            label: "Ground texture",
            targetCategory: "branding",
            targetPath: `${pathPrefix}.ground.image`,
            surface: "studio",
          },
        },
      },
    };
  }

  const goodItems = assets.goodItems;
  if (Array.isArray(goodItems)) {
    goodItems.forEach((item, index) => {
      if (!isRecord(item) || typeof item.image !== "string") return;
      properties[`goodItem${index}`] = {
        type: "object",
        properties: {
          image: {
            type: "string",
            default: item.image,
            "x-control": {
              type: "image",
              label: `Good item ${index + 1} sprite`,
              targetCategory: "branding",
              targetPath: `${pathPrefix}.goodItems.${index}.image`,
              surface: "studio",
            },
          },
        },
      };
    });
  }

  const badItems = assets.badItems;
  if (Array.isArray(badItems)) {
    badItems.forEach((item, index) => {
      if (!isRecord(item) || typeof item.image !== "string") return;
      properties[`badItem${index}`] = {
        type: "object",
        properties: {
          image: {
            type: "string",
            default: item.image,
            "x-control": {
              type: "image",
              label: `Bad item ${index + 1} sprite`,
              targetCategory: "branding",
              targetPath: `${pathPrefix}.badItems.${index}.image`,
              surface: "studio",
            },
          },
        },
      };
    });
  }

  return { type: "object", properties };
}

function schemaFromLegacySection(
  section: Record<string, unknown>,
  targetCategory: "system" | "branding",
  pathPrefix: string,
): TemplateConfigJsonSchema {
  const properties: Record<string, TemplateConfigJsonSchema> = {};

  for (const [key, value] of Object.entries(section)) {
    if (Array.isArray(value)) {
      continue;
    }
    if (isRecord(value) && key === "assets") {
      const assetsSchema = schemaFromLegacyAssets(value, `${pathPrefix}.assets`);
      if (
        assetsSchema.properties &&
        Object.keys(assetsSchema.properties).length > 0
      ) {
        properties.assets = assetsSchema;
      }
      continue;
    }
    if (isRecord(value)) {
      const nested = schemaFromLegacySection(value, targetCategory, `${pathPrefix}.${key}`);
      if (nested.properties && Object.keys(nested.properties).length > 0) {
        properties[key] = nested;
      }
      continue;
    }
    addPrimitiveControl(properties, key, value, targetCategory, pathPrefix);
  }

  return { type: "object", properties };
}

export function buildManifestFromLegacyConfig(
  templateId: string,
  config: Record<string, unknown>,
  label?: string,
): TemplateManifest {
  const schemaProperties: Record<string, TemplateConfigJsonSchema> = {};

  const game = isRecord(config.game) ? config.game : null;
  if (game) {
    const gameSchema = schemaFromLegacySection(game, "branding", "catchGame.game");
    if (gameSchema.properties && Object.keys(gameSchema.properties).length > 0) {
      schemaProperties.catchGame = {
        type: "object",
        properties: {
          game: gameSchema,
        },
      };
    }
  }

  const assets = isRecord(config.assets) ? config.assets : null;
  const physics = isRecord(config.physics) ? config.physics : null;
  const gameplay = isRecord(config.gameplay) ? config.gameplay : null;

  const brandingChildren: Record<string, TemplateConfigJsonSchema> = {};
  if (schemaProperties.catchGame?.properties?.game) {
    brandingChildren.game = schemaProperties.catchGame.properties.game;
  }
  if (assets) {
    const assetsSchema = schemaFromLegacyAssets(assets, "catchGame.assets");
    if (assetsSchema.properties && Object.keys(assetsSchema.properties).length > 0) {
      brandingChildren.assets = assetsSchema;
    }
  }
  if (Object.keys(brandingChildren).length > 0) {
    schemaProperties.catchGame = {
      type: "object",
      properties: brandingChildren,
    };
  }

  const systemChildren: Record<string, TemplateConfigJsonSchema> = {};
  if (physics) {
    systemChildren.physics = schemaFromLegacySection(
      physics,
      "system",
      "catchGame.physics",
    );
  }
  if (gameplay) {
    systemChildren.gameplay = schemaFromLegacySection(
      gameplay,
      "system",
      "catchGame.gameplay",
    );
  }

  if (Object.keys(systemChildren).length > 0) {
    const existing = schemaProperties.catchGame?.properties ?? {};
    schemaProperties.catchGame = {
      type: "object",
      properties: {
        ...existing,
        ...systemChildren,
      },
    };
  }

  const scaffold = normalizeScaffoldManifest(
    {
      meta: {
        templateId,
        name: label ?? templateId.replace(/-/g, " "),
        version: "0.1.0",
      },
      branding: {
        primaryColor: { type: "color", value: "#6366f1" },
      },
      system: {
        gameSpeed: { type: "slider", value: 200, min: 50, max: 800 },
      },
    },
    templateId,
  );

  return {
    ...scaffold,
    label: label ?? scaffold.label,
    description:
      "Imported legacy Vite/Phaser project (controls mapped from public/config.json).",
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: schemaProperties,
    },
  };
}

export function readLegacyConfigFromDir(
  targetDir: string,
): Record<string, unknown> | null {
  const configPath = path.join(targetDir, "public", "config.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
