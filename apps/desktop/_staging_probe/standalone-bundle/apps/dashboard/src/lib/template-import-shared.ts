export const TEMPLATE_LIBRARY_SKIP_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".wrangler",
]);

export const TEMPLATE_EXPORT_SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
]);

export function shouldSkipTemplatePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => TEMPLATE_LIBRARY_SKIP_SEGMENTS.has(segment))) {
    return true;
  }
  const basename = segments[segments.length - 1] ?? "";
  if (TEMPLATE_EXPORT_SKIP_FILES.has(basename)) {
    return true;
  }
  return false;
}

/** Nested `templateId/` mirror left over from a previous export/import cycle. */
export function isNestedTemplateMirrorPath(
  relativePath: string,
  templateId: string,
): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return (
    normalized === templateId ||
    normalized.startsWith(`${templateId}/`)
  );
}
