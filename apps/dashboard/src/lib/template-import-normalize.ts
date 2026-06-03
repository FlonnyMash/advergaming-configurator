import {
  isTemplateManifest,
  type TemplateConfigJsonSchema,
  type TemplateManifest,
} from "@advergaming/shared";
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

type ScaffoldControl = {
  type?: string;
  value?: unknown;
  min?: number;
  max?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function isScaffoldControl(value: unknown): value is ScaffoldControl {
  return isRecord(value) && typeof value.type === "string";
}

export function resolveTemplateIdFromManifest(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const meta = raw.meta;
  if (isRecord(meta) && typeof meta.templateId === "string") {
    return meta.templateId;
  }
  if (typeof raw.id === "string") {
    return raw.id;
  }
  return null;
}

export function isScaffoldManifest(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  if (isTemplateManifest(raw)) return false;
  const meta = raw.meta;
  return isRecord(meta) && typeof meta.templateId === "string";
}

function controlToSchemaProperty(
  key: string,
  control: ScaffoldControl,
  targetCategory: "branding" | "system",
): TemplateConfigJsonSchema {
  const label = humanizeKey(key);
  const targetPath = `${targetCategory === "branding" ? "branding" : "system"}.${key}`;

  if (control.type === "color") {
    const defaultValue =
      typeof control.value === "string" ? control.value : "#6366f1";
    return {
      type: "string",
      default: defaultValue,
      "x-control": {
        type: "color",
        label,
        targetCategory,
        targetPath,
        surface: "both",
      },
    };
  }

  if (control.type === "slider") {
    const defaultValue =
      typeof control.value === "number" ? control.value : 0;
    return {
      type: "number",
      default: defaultValue,
      ...(typeof control.min === "number" ? { minimum: control.min } : {}),
      ...(typeof control.max === "number" ? { maximum: control.max } : {}),
      "x-control": {
        type: "slider",
        label,
        targetCategory,
        targetPath,
        surface: "studio",
        step: 1,
      },
    };
  }

  if (control.type === "text") {
    const defaultValue =
      typeof control.value === "string" ? control.value : "";
    return {
      type: "string",
      default: defaultValue,
      "x-control": {
        type: "text",
        label,
        targetCategory,
        targetPath,
        surface: "configurator",
      },
    };
  }

  return {
    type: "string",
    default: String(control.value ?? ""),
    "x-control": {
      type: "text",
      label,
      targetCategory,
      targetPath,
    },
  };
}

function buildSchemaFromScaffold(raw: Record<string, unknown>): TemplateConfigJsonSchema {
  const properties: Record<string, TemplateConfigJsonSchema> = {};

  for (const category of ["branding", "system"] as const) {
    const section = raw[category];
    if (!isRecord(section)) continue;

    const sectionProperties: Record<string, TemplateConfigJsonSchema> = {};
    for (const [key, value] of Object.entries(section)) {
      if (!isScaffoldControl(value)) continue;
      sectionProperties[key] = controlToSchemaProperty(key, value, category);
    }

    if (Object.keys(sectionProperties).length > 0) {
      properties[category] = {
        type: "object",
        properties: sectionProperties,
      };
    }
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties,
  };
}

export function normalizeScaffoldManifest(
  raw: Record<string, unknown>,
  templateId: string,
): TemplateManifest {
  const meta = isRecord(raw.meta) ? raw.meta : {};
  const label =
    (typeof meta.name === "string" && meta.name.trim()) ||
    humanizeKey(templateId);
  const version =
    (typeof meta.version === "string" && meta.version) || "0.1.0";

  return {
    id: templateId,
    version,
    author: "Imported",
    previewUrl: `/previews/${templateId}.svg`,
    status: "development",
    label,
    description:
      typeof raw.description === "string" ? raw.description : undefined,
    schema: buildSchemaFromScaffold(raw),
    phaserScenes: [],
    uiOverlayComponents: [],
  };
}

export const NORMALIZED_INDEX_TS = `import manifest from "./manifest.json";
import { GameScene as Scene } from "./GameScene";

export { manifest };
export { Scene };
`;

function buildCatchGameBridgeIndexTs(templateId: string): string {
  return `import manifest from "./manifest.json";
import legacyConfig from "./public/config.json";
import { createLegacyBridgeScene } from "../../legacy/LegacyTemplateBridgeScene.ts";
import { PlayScene } from "./src/game/scenes/PlayScene.ts";
import {
  initCatchGameUi,
  unmountCatchGameOverlay,
} from "./src/catchGameOverlay.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPhysicsDebug(config: Record<string, unknown>): boolean {
  const physics = config.physics;
  return isRecord(physics) && physics.debug === true;
}

const Scene = createLegacyBridgeScene({
  templateId: manifest.id,
  baseConfig: legacyConfig as Record<string, unknown>,
  assetUrlPrefix: "/template-assets/${templateId}",
  SceneClass: PlayScene,
  sceneKey: "PlayScene",
  onMountUi: (game, config) => {
    initCatchGameUi(game, readPhysicsDebug(config));
  },
  onUnmountUi: () => {
    unmountCatchGameOverlay();
  },
});

export { manifest };
export { Scene };
`;
}

function repairCatchGameBridgeIndex(
  targetDir: string,
  templateId: string,
): void {
  const indexPath = path.join(targetDir, "index.ts");
  if (
    !existsSync(path.join(targetDir, "src/catchGameOverlay.ts")) ||
    !existsSync(path.join(targetDir, "src/game/scenes/PlayScene.ts")) ||
    !existsSync(path.join(targetDir, "public/config.json")) ||
    !existsSync(indexPath)
  ) {
    return;
  }

  const source = readFileSync(indexPath, "utf8");
  if (source.includes("createLegacyBridgeScene")) {
    return;
  }

  writeFileSync(indexPath, buildCatchGameBridgeIndexTs(templateId), "utf8");
}

function repairTemplateIndexImports(
  targetDir: string,
  templateId: string,
): void {
  const indexPath = path.join(targetDir, "index.ts");
  if (!existsSync(indexPath)) return;

  const bogusPrefix = `./${templateId}/`;
  const source = readFileSync(indexPath, "utf8");
  if (!source.includes(bogusPrefix)) return;

  writeFileSync(indexPath, source.replaceAll(bogusPrefix, "./"), "utf8");
}

function templateRootHasGameSources(targetDir: string): boolean {
  return (
    existsSync(path.join(targetDir, "src")) ||
    existsSync(path.join(targetDir, "GameScene.ts"))
  );
}

/**
 * Removes or hoists a duplicate `templateId/` folder left from export cycles.
 * When the zip root only has manifest/index (portable export) but sources live
 * in the nested mirror, merge nested files up and keep the root manifest.
 */
export function dedupeNestedTemplateRoot(
  targetDir: string,
  templateId: string,
): void {
  const nestedDir = path.join(targetDir, templateId);
  if (!existsSync(nestedDir) || !statSync(nestedDir).isDirectory()) {
    return;
  }

  const nestedManifest = path.join(nestedDir, "manifest.json");
  if (!existsSync(nestedManifest)) {
    return;
  }

  const rootManifest = path.join(targetDir, "manifest.json");
  if (existsSync(rootManifest)) {
    if (templateRootHasGameSources(targetDir)) {
      rmSync(nestedDir, { recursive: true, force: true });
    } else {
      for (const name of readdirSync(nestedDir)) {
        const from = path.join(nestedDir, name);
        if (name === "manifest.json") {
          writeFileSync(
            rootManifest,
            readFileSync(from, "utf8"),
            "utf8",
          );
          continue;
        }
        const to = path.join(targetDir, name);
        if (existsSync(to)) {
          rmSync(to, { recursive: true, force: true });
        }
        renameSync(from, to);
      }
      rmSync(nestedDir, { recursive: true, force: true });
    }
    repairTemplateIndexImports(targetDir, templateId);
    return;
  }

  for (const name of readdirSync(nestedDir)) {
    const from = path.join(nestedDir, name);
    const to = path.join(targetDir, name);
    if (existsSync(to)) {
      rmSync(to, { recursive: true, force: true });
    }
    renameSync(from, to);
  }
  rmSync(nestedDir, { recursive: true, force: true });
  repairTemplateIndexImports(targetDir, templateId);
}

export function normalizeTemplateDirectory(
  targetDir: string,
  templateId: string,
): { ok: true } | { ok: false; error: string } {
  const manifestPath = path.join(targetDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, error: "Missing manifest.json after extraction." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { ok: false, error: "manifest.json is not valid JSON." };
  }

  if (isScaffoldManifest(raw)) {
    const normalized = normalizeScaffoldManifest(raw as Record<string, unknown>, templateId);
    writeFileSync(
      manifestPath,
      `${JSON.stringify(normalized, null, 2)}\n`,
      "utf8",
    );
  } else if (!isTemplateManifest(raw)) {
    return {
      ok: false,
      error:
        "manifest.json is not a valid template manifest. Use a production template or a scaffold zip from New game template.",
    };
  }

  const indexPath = path.join(targetDir, "index.ts");
  if (existsSync(indexPath)) {
    const indexSource = readFileSync(indexPath, "utf8");
    if (/export\s+default\s*[{]/.test(indexSource)) {
      writeFileSync(indexPath, NORMALIZED_INDEX_TS, "utf8");
    }
  }

  const finalManifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!isTemplateManifest(finalManifest)) {
    return { ok: false, error: "Normalized manifest failed validation." };
  }

  if (!existsSync(path.join(targetDir, "index.ts"))) {
    return { ok: false, error: "Missing index.ts in template archive." };
  }

  repairTemplateIndexImports(targetDir, templateId);
  repairCatchGameBridgeIndex(targetDir, templateId);

  return { ok: true };
}
