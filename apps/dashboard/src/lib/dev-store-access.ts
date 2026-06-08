const DEV_STORE_PREVIEW_ENV = "NEXT_PUBLIC_MASHED_DEV_STORE_PREVIEW";
const DEV_STORE_PREVIEW_FLAG = "1";

type MashedRuntimeBridge = {
  devStorePreview?: boolean;
  usesExternalDashboard?: boolean;
};

function readMashedRuntime(): MashedRuntimeBridge | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as Window & { mashedRuntime?: MashedRuntimeBridge }).mashedRuntime ?? null;
}

/** Explicit dev-orchestrator opt-in baked into the Next.js bundle. */
export function isDevStorePreviewFlagEnabled(): boolean {
  return process.env[DEV_STORE_PREVIEW_ENV] === DEV_STORE_PREVIEW_FLAG;
}

/** Trusted runtime flag from the Electron preload bridge (never set in release builds). */
export function isElectronDevStorePreviewEnabled(): boolean {
  return readMashedRuntime()?.devStorePreview === true;
}

export function isNonProductionRuntime(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Allows browsing the template store (and home) without a session.
 * - Web dev: NEXT_PUBLIC flag + NODE_ENV !== "production"
 * - Electron dev / local preview: trusted preload flag from main process env
 */
export function canBrowseStoreWithoutAuth(): boolean {
  if (isDevStorePreviewFlagEnabled() && isNonProductionRuntime()) {
    return true;
  }
  return isElectronDevStorePreviewEnabled();
}

const STORE_BROWSE_PATHS = new Set(["/", "/dashboard/store"]);

export function isStoreBrowsePath(pathname: string): boolean {
  if (STORE_BROWSE_PATHS.has(pathname)) {
    return true;
  }
  return pathname.startsWith("/dashboard/store/");
}

export function isAuthExemptBrowsePath(pathname: string): boolean {
  return canBrowseStoreWithoutAuth() && isStoreBrowsePath(pathname);
}
