const { ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

// Push channel name used for all updater events forwarded to the renderer.
const UPDATER_STATUS_CHANNEL = "updater:status";

// Delay (ms) before the first silent background update check after boot.
const BOOT_CHECK_DELAY_MS = 10_000;

/**
 * Resolves the active BrowserWindow for main → renderer push events.
 * @type {(() => Electron.BrowserWindow | null) | null}
 */
let _getMainWindow = null;

// ---------------------------------------------------------------------------
// Push helper
// ---------------------------------------------------------------------------

function pushStatusToRenderer(event, data = {}) {
  try {
    const win = _getMainWindow?.();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(UPDATER_STATUS_CHANNEL, { event, ...data });
  } catch (err) {
    console.error("[updater] Failed to push status to renderer:", err.message);
  }
}

// ---------------------------------------------------------------------------
// autoUpdater event wiring
// ---------------------------------------------------------------------------

function configureAutoUpdater() {
  // Renderer drives download initiation so users see the download UX.
  autoUpdater.autoDownload = false;
  // Install automatically when the user quits the app normally.
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[updater] checking-for-update");
    pushStatusToRenderer("checking-for-update");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[updater] update-available", info?.version ?? "");
    pushStatusToRenderer("update-available", { version: info?.version ?? null });
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[updater] update-not-available");
    pushStatusToRenderer("update-not-available", { version: info?.version ?? null });
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent ?? 0);
    console.log("[updater] download-progress", percent + "%");
    pushStatusToRenderer("download-progress", {
      percent,
      bytesPerSecond: Math.round(progress.bytesPerSecond ?? 0),
      transferred: progress.transferred ?? 0,
      total: progress.total ?? 0,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[updater] update-downloaded", info?.version ?? "");
    pushStatusToRenderer("update-downloaded", { version: info?.version ?? null });
  });

  autoUpdater.on("error", (err) => {
    // Log full error internally; only send a sanitised code to the renderer —
    // never raw error messages that might expose presigned URLs or server internals.
    console.error("[updater] error", err);
    pushStatusToRenderer("error", { code: "UPDATE_ERROR" });
  });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

async function handleCheckForUpdates() {
  try {
    const result = await autoUpdater.checkForUpdates();
    const updateAvailable = Boolean(result?.updateInfo?.version);
    return {
      ok: true,
      updateAvailable,
      version: result?.updateInfo?.version ?? null,
    };
  } catch (err) {
    console.error("[updater] checkForUpdates failed:", err.message);
    return { ok: false, error: "CHECK_FAILED" };
  }
}

async function handleDownloadUpdate() {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    console.error("[updater] downloadUpdate failed:", err.message);
    return { ok: false, error: "DOWNLOAD_FAILED" };
  }
}

function handleQuitAndInstall() {
  // isSilent=false shows the installer UI on Windows; isForceRunAfter=true
  // relaunches the app after the silent macOS update.
  autoUpdater.quitAndInstall(false, true);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Configures electron-updater and registers the three updater IPC channels.
 * Silently stubs out the channels in non-packaged (dev) mode so that
 * renderer code can still invoke them without errors.
 *
 * Must be called after createMainWindow() so push events have a target.
 *
 * IPC channels (invoke):
 *   updater:check            → { ok, updateAvailable, version? }
 *   updater:download         → { ok, error? }
 *   updater:quit-and-install → (no response — app exits)
 *
 * Push events sent on "updater:status":
 *   checking-for-update
 *   update-available     { version }
 *   update-not-available { version }
 *   download-progress    { percent, bytesPerSecond, transferred, total }
 *   update-downloaded    { version }
 *   error                { code }
 *
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 *   Getter for the active BrowserWindow — use the same closure pattern as
 *   registerExportProjectIpc (avoids holding a stale reference).
 */
function registerUpdaterIpc(getMainWindow) {
  if (typeof getMainWindow !== "function") {
    throw new Error("[updater] registerUpdaterIpc requires a getMainWindow function.");
  }

  _getMainWindow = getMainWindow;

  const { app } = require("electron");

  if (!app.isPackaged) {
    console.info("[updater] Dev mode — auto-updater disabled. IPC stubs registered.");
    ipcMain.handle("updater:check", async () => ({
      ok: true,
      updateAvailable: false,
      version: null,
    }));
    ipcMain.handle("updater:download", async () => ({ ok: true }));
    ipcMain.handle("updater:quit-and-install", () => {});
    return;
  }

  configureAutoUpdater();

  // Silent background check shortly after boot; does not block startup.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("[updater] Background boot check failed:", err.message);
    });
  }, BOOT_CHECK_DELAY_MS);

  ipcMain.handle("updater:check", handleCheckForUpdates);
  ipcMain.handle("updater:download", handleDownloadUpdate);
  ipcMain.handle("updater:quit-and-install", handleQuitAndInstall);
}

module.exports = { registerUpdaterIpc };
