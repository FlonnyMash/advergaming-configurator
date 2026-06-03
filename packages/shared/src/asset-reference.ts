import { z } from "zod";

const STUDIO_PROTOCOL = "mashedgames-studio";

/** Runtime discriminated type; persisted config stores plain strings. */
export type AssetReference =
  | { kind: "inline"; dataUrl: string }
  | { kind: "path"; relativePath: string };

export function isDataUrlAsset(value: string): boolean {
  return value.startsWith("data:");
}

export function isStudioAssetUrl(value: string): boolean {
  return value.startsWith(`${STUDIO_PROTOCOL}://`);
}

/** Relative paths under a project folder (e.g. assets/logo.png). */
export function isProjectRelativeAssetPath(value: string): boolean {
  if (!value || isDataUrlAsset(value) || isStudioAssetUrl(value)) {
    return false;
  }
  const rel = value.replace(/^\//, "");
  return rel.startsWith("assets/") && !rel.includes("..");
}

export function isValidPersistedAssetString(value: string | null): boolean {
  if (value === null) return true;
  return (
    isDataUrlAsset(value) ||
    isProjectRelativeAssetPath(value) ||
    isStudioAssetUrl(value)
  );
}

export function coerceAssetReference(value: string): AssetReference {
  if (isDataUrlAsset(value)) {
    return { kind: "inline", dataUrl: value };
  }
  const relativePath = value.replace(/^\//, "");
  return { kind: "path", relativePath };
}

export function parseAssetReference(value: unknown): AssetReference | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  if (!isValidPersistedAssetString(value)) {
    return null;
  }
  if (isStudioAssetUrl(value)) {
    return null;
  }
  return coerceAssetReference(value);
}

function coerceStringToAssetReference(value: string): AssetReference {
  return coerceAssetReference(value);
}

const InlineAssetReferenceSchema = z.object({
  kind: z.literal("inline"),
  dataUrl: z.string().startsWith("data:"),
});

const PathAssetReferenceSchema = z.object({
  kind: z.literal("path"),
  relativePath: z.string(),
});

export const AssetReferenceSchema = z.union([
  InlineAssetReferenceSchema,
  PathAssetReferenceSchema,
  z.string().transform(coerceStringToAssetReference),
]);

/** Nullable persisted asset field (data URL, assets/ path, or null). */
export const NullableAssetStringSchema = z
  .string()
  .nullable()
  .refine(isValidPersistedAssetString, {
    message: "Must be null, a data URL, or a project-relative assets/ path",
  });
