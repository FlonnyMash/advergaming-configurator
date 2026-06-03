import {
  isDataUrlAsset,
  isProjectRelativeAssetPath,
  isStudioAssetUrl,
} from "@mashedgames/shared";

const STUDIO_PROTOCOL = "mashedgames-studio";

export type ResolveTextureContext = {
  projectId?: string;
  runtimeAssets?: Record<string, string>;
};

/** @deprecated Use getStudioAssetUrl for project-relative paths. */
export function getOSAssetUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  const pathname = /^[a-zA-Z]:/.test(normalized)
    ? `/${normalized}`
    : normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;
  return `${STUDIO_PROTOCOL}://${encodeURIComponent(pathname)}`;
}

export function getStudioAssetUrl(
  relativePath: string,
  projectId: string,
): string {
  const normalized = relativePath.replace(/^\//, "").replace(/\\/g, "/");
  return `${STUDIO_PROTOCOL}:///${normalized}?project=${encodeURIComponent(projectId)}`;
}

export function withCacheBust(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

export function isDataUrl(src: string): boolean {
  return isDataUrlAsset(src);
}

export { isStudioAssetUrl, isProjectRelativeAssetPath };

/** Relative paths copied into Projects/{id}/assets/ (client.json). */
export function isProjectRelativeAsset(src: string): boolean {
  return isProjectRelativeAssetPath(src);
}

export function canUseStudioProtocol(context: {
  projectId?: string;
}): boolean {
  return Boolean(context.projectId);
}

export function isExternalAsset(
  src: string,
  context?: ResolveTextureContext,
): boolean {
  if (!src || isDataUrl(src)) return false;
  if (isStudioAssetUrl(src)) return true;
  if (!isProjectRelativeAsset(src)) return false;
  if (canUseStudioProtocol(context ?? {})) return true;
  const rel = src.replace(/^\//, "");
  return Boolean(context?.runtimeAssets?.[rel]);
}

export function resolveTextureUrl(
  src: string,
  context?: ResolveTextureContext | Record<string, string>,
): string {
  const ctx: ResolveTextureContext =
    context && "projectId" in context
      ? context
      : { runtimeAssets: context as Record<string, string> | undefined };

  if (isDataUrl(src)) return src;
  if (isStudioAssetUrl(src)) return withCacheBust(src);

  const rel = src.replace(/^\//, "");

  if (isProjectRelativeAsset(src) && ctx.projectId) {
    return withCacheBust(getStudioAssetUrl(rel, ctx.projectId));
  }

  if (isProjectRelativeAsset(src) && ctx.runtimeAssets?.[rel]) {
    if (ctx.projectId) {
      return withCacheBust(getStudioAssetUrl(rel, ctx.projectId));
    }
    const absolute = ctx.runtimeAssets[rel];
    if (absolute) {
      return withCacheBust(getOSAssetUrl(absolute));
    }
  }

  return src;
}
