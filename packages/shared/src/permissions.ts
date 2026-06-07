import type { AppMode } from "./flat-game-config";
import type { FlatFieldDefinition, FlatFieldSurface } from "./flat-field-registry";
import { fieldsForMode } from "./flat-field-registry";

export type RegistryResource =
  | "schema:system"
  | "schema:branding"
  | "template:library"
  | "service:diagnostics";

const ACL: Record<AppMode, readonly RegistryResource[]> = {
  studio: ["schema:system", "schema:branding", "template:library"],
  configurator: ["schema:branding", "template:library", "service:diagnostics"],
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

export function surfaceForMode(mode: AppMode): FlatFieldSurface[] {
  if (mode === "studio") {
    return ["studio", "both"];
  }
  return ["configurator", "both"];
}

export function filterFieldsByMode(
  fields: FlatFieldDefinition[],
  mode: AppMode,
): FlatFieldDefinition[] {
  const allowed = new Set(surfaceForMode(mode));
  return fields.filter((field) => allowed.has(field.surface));
}

export function getFieldsForMode(mode: AppMode): FlatFieldDefinition[] {
  return fieldsForMode(mode);
}
