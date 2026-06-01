import type { AppMode, ControlFieldSchema } from "./types";

export type RegistryResource =
  | "schema:system"
  | "schema:branding"
  | "template:development"
  | "template:library"
  | "service:hitbox-debug"
  | "service:animation-builder"
  | "service:publish-template"
  | "service:diagnostics";

const ACL: Record<AppMode, readonly RegistryResource[]> = {
  studio: [
    "schema:system",
    "schema:branding",
    "template:development",
    "template:library",
    "service:hitbox-debug",
    "service:animation-builder",
    "service:publish-template",
  ],
  configurator: [
    "schema:branding",
    "template:library",
    "service:diagnostics",
  ],
};

export class PermissionDeniedError extends Error {
  constructor(mode: AppMode, resource: RegistryResource) {
    super(`[PermissionGuard] ${mode} cannot access ${resource}`);
    this.name = "PermissionDeniedError";
  }
}

export function canAccess(mode: AppMode, resource: RegistryResource): boolean {
  return ACL[mode].includes(resource);
}

export function assertPermission(
  mode: AppMode,
  resource: RegistryResource,
): void {
  if (!canAccess(mode, resource)) {
    throw new PermissionDeniedError(mode, resource);
  }
}

export function surfaceForMode(mode: AppMode): ControlFieldSchema["surface"][] {
  if (mode === "studio") {
    return ["studio", "both"];
  }
  return ["configurator", "both"];
}

export function filterSchemaControls(
  controls: ControlFieldSchema[],
  mode: AppMode,
): ControlFieldSchema[] {
  const allowedSurfaces = new Set(surfaceForMode(mode));
  return controls.filter((control) => allowedSurfaces.has(control.surface));
}

export function filterSchemaByMode(
  schema: import("./types.js").GameSchema,
  mode: AppMode,
): import("./types.js").GameSchema {
  return {
    ...schema,
    controls: filterSchemaControls(schema.controls, mode),
  };
}
