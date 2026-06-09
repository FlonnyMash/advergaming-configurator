/**
 * TemplateDownloader
 *
 * Renderer-safe, React-friendly class for driving the full template install
 * pipeline from dashboard components and hooks.
 *
 * All filesystem I/O (download, SHA-256 verify, zip-slip-safe extraction,
 * atomic rename) happens exclusively in the Electron main process via IPC.
 * This class is a typed orchestrator — it never touches `fs`, `crypto`, or
 * `adm-zip` directly, keeping the renderer process sandbox intact.
 *
 * Usage in a React component:
 *
 * ```tsx
 * const downloader = useMemo(() => new TemplateDownloader(), []);
 *
 * useEffect(() => {
 *   return downloader.subscribe((phase, percent) => {
 *     setInstallState({ phase, percent });
 *   });
 * }, [downloader]);
 *
 * async function handleInstall() {
 *   try {
 *     const { version } = await downloader.download(templateSlug);
 *     toast.success(`Installed v${version}`);
 *   } catch (err) {
 *     toast.error(err instanceof TemplateDownloadError ? err.message : "Install failed");
 *   }
 * }
 * ```
 */

import {
  checkTemplateVersion,
  installTemplate,
  onTemplateInstallProgress,
  type CheckTemplateVersionResult,
  type InstallTemplateResult,
  type TemplateInstallProgressEvent,
} from "./template-update-ipc";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Install phase names emitted during a template:install operation. */
export type InstallPhase = TemplateInstallProgressEvent["phase"];

/** Structured error thrown by TemplateDownloader.download() on failure. */
export class TemplateDownloadError extends Error {
  constructor(
    message: string,
    /** The raw error code returned by the IPC handler, e.g. "CHECKSUM_MISMATCH". */
    public readonly code: string,
  ) {
    super(message);
    this.name = "TemplateDownloadError";
  }
}

/** Result of a successful template download. */
export interface DownloadResult {
  /** Installed semantic version string, e.g. "1.2.0". */
  version: string;
  /** Template slug that was installed. */
  templateSlug: string;
}

/** Registry metadata returned before the download begins. */
export interface TemplateRegistryInfo {
  templateId: string;
  version: string;
  storageKey: string;
  checksum: string | null;
}

/** Progress callback signature. */
export type ProgressCallback = (phase: InstallPhase, percent: number) => void;

// ---------------------------------------------------------------------------
// Error code → human-readable message map
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_TEMPLATE_SLUG: "Invalid template identifier.",
  NOT_AUTHENTICATED: "You must be signed in to install templates.",
  CLIENT_ERROR: "Failed to connect to the template registry.",
  QUERY_ERROR: "Registry query failed — please try again.",
  TEMPLATE_NOT_FOUND: "Template not found in the registry.",
  NETWORK_ERROR: "Network error — check your internet connection.",
  DOWNLOAD_FAILED: "Template bundle download failed.",
  CHECKSUM_MISMATCH:
    "Download integrity check failed. The bundle may be corrupted.",
  VERIFY_FAILED: "Integrity verification could not be completed.",
  EXTRACT_FAILED: "Bundle extraction failed.",
  INSTALL_FAILED: "Failed to write template to workspace.",
  WORKSPACE_NOT_READY: "Workspace is not ready. Please restart the app.",
  PATH_TRAVERSAL_DETECTED:
    "Security check failed: invalid template path detected.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? `Install failed (${code}).`;
}

// ---------------------------------------------------------------------------
// TemplateDownloader
// ---------------------------------------------------------------------------

export class TemplateDownloader {
  private readonly _progressCallbacks = new Set<ProgressCallback>();

  // -------------------------------------------------------------------------
  // Progress subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribes to install progress events pushed by the main process.
   *
   * Returns an unsubscribe function — pass it directly as the `useEffect`
   * cleanup return value to prevent listener leaks on unmount.
   *
   * No-op outside the Electron runtime; returns an empty cleanup function.
   *
   * @example
   * useEffect(() => downloader.subscribe((phase, percent) => {
   *   setPhase(phase);
   *   setPercent(percent);
   * }), [downloader]);
   */
  subscribe(cb: ProgressCallback): () => void {
    this._progressCallbacks.add(cb);

    // Wire to the raw IPC push channel once per TemplateDownloader instance.
    // Re-wiring per subscribe() call is intentionally avoided — one IPC
    // listener fans out to all registered callbacks.
    const unsubscribeIpc = onTemplateInstallProgress(
      ({ phase, percent }: TemplateInstallProgressEvent) => {
        for (const fn of this._progressCallbacks) {
          fn(phase, percent);
        }
      },
    );

    return () => {
      this._progressCallbacks.delete(cb);
      if (this._progressCallbacks.size === 0) {
        unsubscribeIpc();
      }
    };
  }

  // -------------------------------------------------------------------------
  // Registry query
  // -------------------------------------------------------------------------

  /**
   * Queries the Supabase `templates` registry for the latest non-yanked
   * version of the given template slug (authenticated, via main process).
   *
   * Useful for pre-flight version comparisons before calling `download()`.
   *
   * Returns `null` outside the Electron runtime.
   *
   * @throws {TemplateDownloadError} if the query fails or the template is not found.
   */
  async checkVersion(templateSlug: string): Promise<TemplateRegistryInfo | null> {
    const result: CheckTemplateVersionResult | null =
      await checkTemplateVersion(templateSlug);

    if (result === null) return null;

    if (!result.ok) {
      throw new TemplateDownloadError(errorMessage(result.error), result.error);
    }

    return {
      templateId: result.templateId,
      version: result.version,
      storageKey: result.storageKey,
      checksum: result.checksum,
    };
  }

  // -------------------------------------------------------------------------
  // Full install pipeline
  // -------------------------------------------------------------------------

  /**
   * Downloads and installs the latest version of a template.
   *
   * Delegates the full pipeline to the main process:
   *   1. Registry query (Supabase `templates` table)
   *   2. Bundle download to temp file (R2 via `MASHED_BUNDLE_BASE_URL`)
   *   3. SHA-256 checksum verification
   *   4. Zip-slip-safe extraction into a staging directory
   *   5. Atomic rename into `{workspace}/Templates/{templateSlug}/`
   *
   * Subscribe to progress events before calling this method if you need
   * a progress bar — use `downloader.subscribe(cb)` in a `useEffect`.
   *
   * Returns `null` outside the Electron runtime.
   *
   * @throws {TemplateDownloadError} on any pipeline failure. The `code`
   *   property contains the IPC error code for structured error handling.
   */
  async download(templateSlug: string): Promise<DownloadResult | null> {
    const result: InstallTemplateResult | null =
      await installTemplate(templateSlug);

    if (result === null) return null;

    if (!result.ok) {
      throw new TemplateDownloadError(errorMessage(result.error), result.error);
    }

    return {
      version: result.version,
      templateSlug,
    };
  }
}
