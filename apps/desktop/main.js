const fs = require("node:fs");
const path = require("node:path");
const { fork } = require("node:child_process");
const { app, BrowserWindow } = require("electron");
const { autoUpdater } = require("electron-updater");
const getPortImport = require("get-port");

const getPort = getPortImport.default ?? getPortImport;

let mainWindow = null;
let dashboardServer = null;

function resolveStandaloneServerPath() {
  if (app.isPackaged) {
    return path.join(
      app.getAppPath(),
      "standalone",
      "apps",
      "dashboard",
      "server.js",
    );
  }
  return path.resolve(
    __dirname,
    "../dashboard/.next/standalone/apps/dashboard/server.js",
  );
}

function getPersistentWorkspacePath() {
  return path.join(app.getPath("documents"), "AdvergamingStudio", "Projects");
}

function ensureWorkspaceDir(workspacePath) {
  fs.mkdirSync(workspacePath, { recursive: true });
}

function pickLegacyGamesDir() {
  const candidates = [
    path.resolve(process.cwd(), "games"),
    path.resolve(path.dirname(process.execPath), "games"),
    path.resolve(__dirname, "../../games"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function autoMigrateLegacyProjects(workspacePath) {
  const legacyDir = pickLegacyGamesDir();
  if (!legacyDir) {
    return;
  }

  const entries = fs.readdirSync(legacyDir);
  if (entries.length === 0) {
    return;
  }

  fs.cpSync(legacyDir, workspacePath, {
    recursive: true,
    force: true,
  });

  const backupBase = path.join(path.dirname(legacyDir), "games_migrated_backup");
  let backupPath = backupBase;
  if (fs.existsSync(backupPath)) {
    backupPath = `${backupBase}_${Date.now()}`;
  }
  fs.renameSync(legacyDir, backupPath);
}

async function spawnDashboardServer(workspacePath) {
  const port = await getPort();
  const serverEntry = resolveStandaloneServerPath();
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Dashboard standalone server not found: ${serverEntry}`);
  }

  dashboardServer = fork(serverEntry, [], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      WORKSPACE_DIR: workspacePath,
    },
    stdio: "inherit",
  });

  return port;
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.on("checking-for-update", () => {
    console.log("[updater] checking-for-update");
  });
  autoUpdater.on("update-available", (info) => {
    console.log("[updater] update-available", info?.version ?? "");
  });
  autoUpdater.on("update-not-available", () => {
    console.log("[updater] update-not-available");
  });
  autoUpdater.on("download-progress", (progress) => {
    console.log("[updater] download-progress", Math.round(progress.percent));
  });
  autoUpdater.on("update-downloaded", () => {
    console.log("[updater] update-downloaded");
  });
  autoUpdater.on("error", (error) => {
    console.error("[updater] error", error);
  });
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error("[updater] check failed", error);
  });
}

function cleanupDashboardServer() {
  if (dashboardServer && !dashboardServer.killed) {
    try {
      // Force kill to release Windows file locks instantly during NSIS updates
      dashboardServer.kill("SIGKILL");
    } catch (e) {
      console.error("[shutdown] Failed to kill dashboard server:", e);
      if (typeof dashboardServer.pid === "number") {
        try {
          process.kill(dashboardServer.pid, "SIGKILL");
        } catch (fallbackError) {
          console.error("[shutdown] Fallback process.kill failed:", fallbackError);
        }
      }
    }
  }
  dashboardServer = null;
}

app.whenReady().then(async () => {
  const workspacePath = getPersistentWorkspacePath();
  ensureWorkspaceDir(workspacePath);
  autoMigrateLegacyProjects(workspacePath);
  const port = await spawnDashboardServer(workspacePath);
  createMainWindow(port);
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(port);
    }
  });
});

app.on("before-quit", cleanupDashboardServer);
app.on("window-all-closed", () => {
  cleanupDashboardServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
