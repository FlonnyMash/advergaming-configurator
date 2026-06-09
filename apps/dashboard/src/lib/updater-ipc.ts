/**
 * Typed IPC client for the Electron auto-updater channels.
 *
 * All functions return null when called outside the Electron runtime (browser
 * dev context) so layout and UI can be developed offline without a running
 * Electron shell — the same pattern used by auth-ipc.ts.
 *
 * To subscribe to push events from the main process use `onUpdaterStatus`.
 * The main process sends events on the "updater:status" channel whenever
 * autoUpdater emits a lifecycle event.
 */

/** Push event shapes sent by the main process on "updater:status". */
export type UpdaterStatusEvent =
  | { event: "checking-for-update" }
  | { event: "update-available"; version: string | null }
  | { event: "update-not-available"; version: string | null }
  | {
      event: "download-progress";
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }
  | { event: "update-downloaded"; version: string | null }
  | { event: "error"; code: string };

export type CheckForUpdatesResult =
  | { ok: true; updateAvailable: boolean; version: string | null }
  | { ok: false; error: string };

export type DownloadUpdateResult = { ok: true } | { ok: false; error: string };

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
 * Requests an explicit update check from the main process.
 * The main process will also emit "update-available" / "update-not-available"
 * events on the "updater:status" push channel as a side effect.
 *
 * Returns null outside the Electron runtime.
 */
export async function checkForUpdates(): Promise<CheckForUpdatesResult | null> {
  const electron = getElectron();
  if (!electron) return null;
  try {
    return await electron.invoke("updater:check");
  } catch (err) {
    if (isMissingIpcHandlerError(err)) return null;
    throw err;
  }
}

/**
 * Instructs the main process to begin downloading the available update.
 * Progress is streamed via "download-progress" events on the push channel.
 *
 * Returns null outside the Electron runtime.
 */
export async function downloadUpdate(): Promise<DownloadUpdateResult | null> {
  const electron = getElectron();
  if (!electron) return null;
  try {
    return await electron.invoke("updater:download");
  } catch (err) {
    if (isMissingIpcHandlerError(err)) return null;
    throw err;
  }
}

/**
 * Instructs the main process to quit and install the downloaded update.
 * The app will exit immediately — this call does not return.
 *
 * Returns null outside the Electron runtime.
 */
export async function quitAndInstall(): Promise<null> {
  const electron = getElectron();
  if (!electron) return null;
  try {
    await electron.invoke("updater:quit-and-install");
  } catch (err) {
    if (isMissingIpcHandlerError(err)) return null;
    throw err;
  }
  return null;
}

/**
 * Subscribes to updater status push events from the main process.
 * Returns an unsubscribe function — call it in useEffect cleanup or
 * component unmount to prevent listener leaks.
 *
 * No-op outside the Electron runtime; returns an empty unsubscribe function.
 *
 * @example
 * useEffect(() => {
 *   return onUpdaterStatus((status) => {
 *     if (status.event === "update-available") setUpdateVersion(status.version);
 *   });
 * }, []);
 */
export function onUpdaterStatus(
  cb: (status: UpdaterStatusEvent) => void,
): () => void {
  const ipc = window.electron?.ipcRenderer;
  if (!ipc || typeof ipc.on !== "function") return () => {};

  const listener = (_event: unknown, status: UpdaterStatusEvent) => cb(status);
  ipc.on("updater:status", listener);

  return () => {
    if (typeof ipc.removeListener === "function") {
      ipc.removeListener("updater:status", listener);
    }
  };
}
