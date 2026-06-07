export const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function isTemplateManifest(_value: unknown): boolean {
  return false;
}

export function normalizeImportedTemplate(_input: unknown): null {
  return null;
}
