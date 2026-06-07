/** Default template id for desktop runtime. */
export const DESKTOP_BUNDLED_TEMPLATE_ID = "default";

function readEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

function isProductionEnv(): boolean {
  return readEnv("NODE_ENV") === "production";
}

function hasElectronPreload(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const candidate = window as Window & {
    electron?: { ipcRenderer?: unknown };
  };
  return Boolean(candidate.electron?.ipcRenderer);
}

function isDesktopRuntime(): boolean {
  if (readEnv("NEXT_PUBLIC_WORKSPACE_DESKTOP") === "1") {
    return true;
  }
  return hasElectronPreload();
}

export function getDesktopBundledTemplateIds(): string[] | null {
  if (!isDesktopRuntime()) {
    return null;
  }

  const raw = readEnv("NEXT_PUBLIC_BUNDLED_TEMPLATES")?.trim();
  if (!raw) {
    return [DESKTOP_BUNDLED_TEMPLATE_ID];
  }

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Base URL for static game-engine assets embedded under `/engine`.
 */
export function resolveGameEngineBaseUrl(): string {
  const devUrl = (
    readEnv("NEXT_PUBLIC_GAME_ENGINE_URL") ?? "http://localhost:5173"
  ).replace(/\/$/, "");

  if (typeof window !== "undefined") {
    if (isDesktopRuntime() || isProductionEnv()) {
      return `${window.location.origin}/engine`;
    }
    return devUrl;
  }

  if (isDesktopRuntime() || isProductionEnv()) {
    return "/engine";
  }

  return devUrl;
}

export function resolveTemplatePreviewUrl(
  previewUrl: string,
  options?: { cacheBust?: number },
): string {
  const path = previewUrl.startsWith("/") ? previewUrl : `/${previewUrl}`;
  const url = `${resolveGameEngineBaseUrl()}${path}`;
  return options?.cacheBust ? `${url}?t=${options.cacheBust}` : url;
}

/** Resolves a persisted asset string to a URL suitable for sidebar img previews. */
export function resolveControlAssetPreviewSrc(
  assetUrl: string | null | undefined,
): string | null {
  if (!assetUrl || assetUrl.trim() === "") {
    return null;
  }

  const trimmed = assetUrl.trim();
  if (trimmed.startsWith("data:")) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("mashedgames-studio://")) {
    return null;
  }
  if (trimmed.startsWith("/")) {
    return resolveTemplatePreviewUrl(trimmed);
  }
  if (trimmed.startsWith("assets/")) {
    return null;
  }

  return resolveTemplatePreviewUrl(`/${trimmed.replace(/^\//, "")}`);
}
