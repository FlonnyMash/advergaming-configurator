const STUDIO_PROTOCOL = "mashedgames-studio";

export function getOSAssetUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  const pathname = /^[a-zA-Z]:/.test(normalized)
    ? `/${normalized}`
    : normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;
  return `${STUDIO_PROTOCOL}://${encodeURIComponent(pathname)}`;
}

export function withCacheBust(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

export function isDataUrl(src: string): boolean {
  return src.startsWith("data:");
}

export function isStudioAssetUrl(src: string): boolean {
  return src.startsWith(`${STUDIO_PROTOCOL}://`);
}

/** Relative paths copied into Projects/{id}/assets/ (client.json). */
export function isProjectRelativeAsset(src: string): boolean {
  if (!src || isDataUrl(src) || isStudioAssetUrl(src)) return false;
  const rel = src.replace(/^\//, "");
  return rel.startsWith("assets/");
}

export function isExternalAsset(
  src: string,
  runtimeAssets?: Record<string, string>,
): boolean {
  if (!src || isDataUrl(src)) return false;
  if (isStudioAssetUrl(src)) return true;
  if (!isProjectRelativeAsset(src)) return false;
  const rel = src.replace(/^\//, "");
  return Boolean(runtimeAssets?.[rel]);
}

export function resolveTextureUrl(
  src: string,
  runtimeAssets?: Record<string, string>,
): string {
  if (isDataUrl(src)) return src;
  if (isStudioAssetUrl(src)) return withCacheBust(src);
  if (isProjectRelativeAsset(src) && runtimeAssets) {
    const rel = src.replace(/^\//, "");
    const absolute = runtimeAssets[rel];
    if (absolute) return withCacheBust(getOSAssetUrl(absolute));
  }
  return src;
}
