/** Rewrite `/assets/...` paths from legacy standalone games to engine-served URLs. */
export function rewriteLegacyAssetUrls(
  value: unknown,
  assetUrlPrefix: string,
): unknown {
  if (typeof value === "string") {
    if (value.startsWith("/assets/")) {
      return `${assetUrlPrefix}${value}`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => rewriteLegacyAssetUrls(entry, assetUrlPrefix));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = rewriteLegacyAssetUrls(child, assetUrlPrefix);
    }
    return out;
  }

  return value;
}
