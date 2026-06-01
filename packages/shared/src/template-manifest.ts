import type { AppMode } from "./types";
import { filterSchemaControls } from "./permissions";
import type {
  ConfigRootCategory,
  ControlFieldSchema,
  ControlSurface,
  ControlType,
  GameSchema,
} from "./types";

export type TemplateManifestStatus = "development" | "production";

/**
 * Dashboard control metadata embedded in JSON Schema leaves via `x-control`.
 */
export type LegacyControlCategory = "theme" | "gameplay" | "domOverlay";

export interface JsonSchemaControlExtension {
  type: ControlType;
  label: string;
  targetCategory?: ConfigRootCategory | LegacyControlCategory;
  targetPath?: string;
  surface?: ControlSurface;
  step?: number;
  placeholder?: string;
}

export interface TemplateConfigJsonSchema {
  $schema?: string;
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, TemplateConfigJsonSchema>;
  "x-control"?: JsonSchemaControlExtension;
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

export interface TemplateManifest {
  id: string;
  version: string;
  author: string;
  previewUrl: string;
  status: TemplateManifestStatus;
  label: string;
  description?: string;
  schema: TemplateConfigJsonSchema;
}

export interface TemplateCatalogEntry {
  manifest: TemplateManifest;
  source: "library" | "development";
}

export function isTemplateManifest(value: unknown): value is TemplateManifest {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.version === "string" &&
    typeof m.author === "string" &&
    typeof m.previewUrl === "string" &&
    (m.status === "development" || m.status === "production") &&
    typeof m.label === "string" &&
    typeof m.schema === "object" &&
    m.schema !== null
  );
}

const LEGACY_CATEGORY_MAP: Record<
  "theme" | "gameplay" | "domOverlay",
  { targetCategory: ConfigRootCategory; targetPathPrefix: string }
> = {
  theme: { targetCategory: "branding", targetPathPrefix: "theme" },
  gameplay: { targetCategory: "system", targetPathPrefix: "mechanics" },
  domOverlay: { targetCategory: "branding", targetPathPrefix: "domOverlay" },
};

function resolveControlMeta(
  fieldKey: string,
  xControl: JsonSchemaControlExtension,
): Pick<ControlFieldSchema, "targetCategory" | "targetPath" | "surface"> {
  if (
    xControl.targetPath &&
    (xControl.targetCategory === "system" || xControl.targetCategory === "branding")
  ) {
    return {
      targetCategory: xControl.targetCategory,
      targetPath: xControl.targetPath,
      surface: xControl.surface ?? "both",
    };
  }

  const legacy = xControl.targetCategory;
  if (legacy === "theme" || legacy === "gameplay" || legacy === "domOverlay") {
    const mapped = LEGACY_CATEGORY_MAP[legacy];
    const pathKey =
      legacy === "gameplay" && fieldKey === "playerSpeed"
        ? "playerSpeed"
        : fieldKey;
    return {
      targetCategory: mapped.targetCategory,
      targetPath: `${mapped.targetPathPrefix}.${pathKey}`,
      surface:
        xControl.surface ??
        (mapped.targetCategory === "system" ? "studio" : "both"),
    };
  }

  return {
    targetCategory: "branding",
    targetPath: xControl.targetPath ?? fieldKey,
    surface: xControl.surface ?? "both",
  };
}

function collectControlsFromNode(
  node: TemplateConfigJsonSchema,
  pathPrefix: string,
  defaultCategory: ConfigRootCategory,
): ControlFieldSchema[] {
  const controls: ControlFieldSchema[] = [];

  if (node["x-control"]) {
    const xControl = node["x-control"];
    const fieldKey = pathPrefix.split(".").pop() ?? pathPrefix;
    const meta = resolveControlMeta(fieldKey, {
      ...xControl,
      targetCategory: xControl.targetCategory ?? defaultCategory,
      targetPath: xControl.targetPath ?? pathPrefix,
    });
    controls.push({
      key: fieldKey,
      label: xControl.label,
      type: xControl.type,
      targetCategory: meta.targetCategory,
      targetPath: meta.targetPath,
      surface: meta.surface,
      defaultValue: node.default as ControlFieldSchema["defaultValue"],
      min: node.minimum,
      max: node.maximum,
      step: xControl.step,
      placeholder: xControl.placeholder,
    });
    return controls;
  }

  if (!node.properties) return controls;

  for (const [key, child] of Object.entries(node.properties)) {
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    controls.push(
      ...collectControlsFromNode(child, childPath, defaultCategory),
    );
  }

  return controls;
}

function collectControlsFromCategory(
  rootKey: string,
  categorySchema: TemplateConfigJsonSchema,
  defaultCategory?: ConfigRootCategory,
): ControlFieldSchema[] {
  const inferredCategory: ConfigRootCategory =
    rootKey === "system" || rootKey === "branding"
      ? rootKey
      : (defaultCategory ?? "branding");

  return collectControlsFromNode(categorySchema, "", inferredCategory).map(
    (control) => {
      if (control.targetPath) return control;
      return control;
    },
  );
}

function collectControlsFromRoot(
  schema: TemplateConfigJsonSchema,
): ControlFieldSchema[] {
  const controls: ControlFieldSchema[] = [];
  if (!schema.properties) return controls;

  for (const [rootKey, categorySchema] of Object.entries(schema.properties)) {
    if (rootKey === "system" || rootKey === "branding") {
      controls.push(...collectControlsFromCategory(rootKey, categorySchema));
      continue;
    }

    controls.push(
      ...collectControlsFromCategory(rootKey, categorySchema, undefined),
    );
  }

  return controls;
}

/** Derive dashboard `GameSchema` from a template manifest JSON Schema. */
export function gameSchemaFromManifest(manifest: TemplateManifest): GameSchema {
  const controls = collectControlsFromRoot(manifest.schema);
  return {
    id: manifest.id,
    label: manifest.label,
    description: manifest.description,
    controls,
  };
}

export function gameSchemaFromManifestForMode(
  manifest: TemplateManifest,
  mode: AppMode,
): GameSchema {
  const schema = gameSchemaFromManifest(manifest);
  return {
    ...schema,
    controls: filterSchemaControls(schema.controls, mode),
  };
}

export function bumpSemverPatch(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return "1.0.0";
  const patch = Number.parseInt(match[3]!, 10) + 1;
  return `${match[1]}.${match[2]}.${patch}`;
}
