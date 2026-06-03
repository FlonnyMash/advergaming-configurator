/** Default template shipped with the Electron desktop installer. */
export const DESKTOP_BUNDLED_TEMPLATE_ID = "catch-game-demo";

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
  if (process.env.NEXT_PUBLIC_WORKSPACE_DESKTOP === "1") {
    return true;
  }

  return hasElectronPreload();
}

export function getDesktopBundledTemplateIds(): string[] | null {
  if (!isDesktopRuntime()) {
    return null;
  }

  const raw = process.env.NEXT_PUBLIC_BUNDLED_TEMPLATES?.trim();
  if (!raw) {
    return [DESKTOP_BUNDLED_TEMPLATE_ID];
  }

  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Base URL for static game-engine assets (previews, template-assets).
 * Desktop and production web embed the built engine under `/engine` on the dashboard origin.
 */
export function resolveGameEngineBaseUrl(): string {
  const devUrl = (
    process.env.NEXT_PUBLIC_GAME_ENGINE_URL ?? "http://localhost:5173"
  ).replace(/\/$/, "");

  if (typeof window !== "undefined") {
    if (isDesktopRuntime() || process.env.NODE_ENV === "production") {
      return `${window.location.origin}/engine`;
    }
    return devUrl;
  }

  if (isDesktopRuntime() || process.env.NODE_ENV === "production") {
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
