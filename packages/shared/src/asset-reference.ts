import { z } from "zod";

export const STUDIO_PROTOCOL = "mashedgames-studio" as const;

export const ProjectRelativePathSchema = z
  .string()
  .regex(/^assets\/[^\s]+$/, "Must be a project-relative assets/ path");

export const StudioAssetUrlSchema = z
  .string()
  .regex(
    /^mashedgames-studio:\/\/\/[^\s?]+(\?project=[^&\s]+)?$/,
    "Must be a mashedgames-studio:// asset URL",
  );

export const NullableAssetStringSchema = z
  .string()
  .refine((value) => !value.startsWith("data:"), "Base64 data URLs are prohibited")
  .refine(
    (value) =>
      value === "" ||
      ProjectRelativePathSchema.safeParse(value).success ||
      StudioAssetUrlSchema.safeParse(value).success ||
      value.startsWith("http://") ||
      value.startsWith("https://"),
    "Asset must be a relative path, studio protocol URL, or http(s) URL",
  );

export type AssetReference = z.infer<typeof NullableAssetStringSchema>;

export function isDataUrlAsset(value: string): boolean {
  return value.startsWith("data:");
}

export function isProjectRelativeAssetPath(value: string): boolean {
  return ProjectRelativePathSchema.safeParse(value).success;
}

export function isStudioAssetUrl(value: string): boolean {
  return value.startsWith(`${STUDIO_PROTOCOL}://`);
}

export function isValidPersistedAssetString(value: string): boolean {
  if (!value || isDataUrlAsset(value)) {
    return false;
  }
  return NullableAssetStringSchema.safeParse(value).success;
}

export function resolveStudioAssetUrl(
  relativePath: string,
  projectId: string,
): string {
  const normalized = relativePath.replace(/^\//, "").replace(/\\/g, "/");
  return `${STUDIO_PROTOCOL}:///${normalized}?project=${encodeURIComponent(projectId)}`;
}

export function coerceAssetReference(
  value: unknown,
  projectId?: string,
): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const trimmed = value.trim();
  if (isDataUrlAsset(trimmed)) {
    return null;
  }
  if (isStudioAssetUrl(trimmed)) {
    return trimmed;
  }
  if (isProjectRelativeAssetPath(trimmed) && projectId) {
    return resolveStudioAssetUrl(trimmed, projectId);
  }
  if (NullableAssetStringSchema.safeParse(trimmed).success) {
    return trimmed;
  }
  return null;
}

export function parseAssetReference(value: unknown): AssetReference | null {
  const result = NullableAssetStringSchema.safeParse(value);
  return result.success ? result.data : null;
}
