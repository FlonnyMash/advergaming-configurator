/**
 * Typed IPC client for the Electron template update channels.
 *
 * All functions return null when called outside the Electron runtime (browser
 * dev context) — the same pattern used by auth-ipc.ts and updater-ipc.ts.
 *
 * Template bundles are installed to {workspace}/Templates/{templateSlug}/ by
 * the main process. The renderer never touches the filesystem directly — it
 * drives the install via IPC and subscribes to progress events.
 */

/** Safe registry metadata returned by template:check-version (no tokens or raw DB rows). */
export type TemplateVersionInfo = {
  templateId: string;
  version: string;
  storageKey: string;
  checksum: string | null;
};

export type CheckTemplateVersionResult =
  | ({ ok: true } & TemplateVersionInfo)
  | { ok: false; error: string };

export type InstalledVersionResult =
  | { ok: true; version: string | null }
  | { ok: false; error: string };

export type InstallTemplateResult =
  | { ok: true; version: string }
  | { ok: false; error: string };

/**
 * Push event emitted by the main process during template:install.
 *
 * Phases in order: checking → downloading → verifying → extracting → installing → done
 * `percent` is 0–100 within each phase.
 */
export type TemplateInstallProgressEvent = {
  templateSlug: string;
  phase:
    | "checking"
    | "downloading"
    | "verifying"
    | "extracting"
    | "installing"
    | "done";
  percent: number;
};

function getElectron() {
  return window.electron?.ipcRenderer ?? null;
}

function isMissingIpcHandlerError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return (
    msg.includes("No handler registered for") ||
    msg.includes("IPC channel not allowed")
  );
}

/**
 * Queries the Supabase `templates` registry for the latest non-yanked
 * version of the given template slug (authenticated, via main process).
 *
 * Returns null outside the Electron runtime.
 */
export async function checkTemplateVersion(
  templateSlug: string,
): Promise<CheckTemplateVersionResult | null> {
  const electron = getElectron();
  if (!electron) return null;
  try {
    return await electron.invoke("template:check-version", { templateSlug });
  } catch (err) {
    if (isMissingIpcHandlerError(err)) return null;
    throw err;
  }
}

/**
 * Reads the locally installed version for the given template slug by
 * inspecting {workspace}/Templates/{templateSlug}/manifest.json.
 * Returns { version: null } when the template is not yet installed.
 *
 * Returns null outside the Electron runtime.
 */
export async function getInstalledTemplateVersion(
  templateSlug: string,
): Promise<InstalledVersionResult | null> {
  const electron = getElectron();
  if (!electron) return null;
  try {
    return await electron.invoke("template:get-installed-version", {
      templateSlug,
    });
  } catch (err) {
    if (isMissingIpcHandlerError(err)) return null;
    throw err;
  }
}

/**
 * Downloads and installs the latest version of a template from the registry.
 *
 * The main process streams progress via the "template:install-progress" push
 * channel — subscribe with `onTemplateInstallProgress` before calling this
 * function if you want to show a progress bar.
 *
 * Returns null outside the Electron runtime.
 */
export async function installTemplate(
  templateSlug: string,
): Promise<InstallTemplateResult | null> {
  const electron = getElectron();
  if (!electron) return null;
  try {
    return await electron.invoke("template:install", { templateSlug });
  } catch (err) {
    if (isMissingIpcHandlerError(err)) return null;
    throw err;
  }
}

/**
 * Subscribes to template install progress events from the main process.
 * Returns an unsubscribe function — call it on component unmount.
 *
 * No-op outside the Electron runtime; returns an empty unsubscribe function.
 *
 * @example
 * useEffect(() => {
 *   return onTemplateInstallProgress(({ templateSlug, phase, percent }) => {
 *     if (templateSlug === activeSlug) setInstallPhase(phase);
 *   });
 * }, [activeSlug]);
 */
export function onTemplateInstallProgress(
  cb: (event: TemplateInstallProgressEvent) => void,
): () => void {
  const ipc = window.electron?.ipcRenderer;
  if (!ipc || typeof ipc.on !== "function") return () => {};

  const listener = (
    _event: unknown,
    data: TemplateInstallProgressEvent,
  ) => cb(data);
  ipc.on("template:install-progress", listener);

  return () => {
    if (typeof ipc.removeListener === "function") {
      ipc.removeListener("template:install-progress", listener);
    }
  };
}
