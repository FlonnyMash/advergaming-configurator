const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const getPort = require("get-port");

let mainWindow = null;
let dashboardServer = null;
let dashboardPort = null;

function resolveStandaloneServerPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
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

function probeUrl(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode < 500));
    });
    request.on("error", () => resolve(false));
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForDashboardServer(port) {
  const deadline = Date.now() + 30_000;
  const urls = [
    `http://127.0.0.1:${port}/`,
    `http://127.0.0.1:${port}/engine/index.html`,
  ];

  while (Date.now() < deadline) {
    const ready = await Promise.all(urls.map((url) => probeUrl(url)));
    if (ready.every(Boolean)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Dashboard server did not become ready on port ${port} (checked / and /engine/index.html)`,
  );
}

async function spawnDashboardServer(workspacePath) {
  const port = await getPort();
  const serverEntry = resolveStandaloneServerPath();
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Dashboard standalone server not found: ${serverEntry}`);
  }

  dashboardServer = spawn(process.execPath, [serverEntry], {
    cwd: path.dirname(serverEntry),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      WORKSPACE_DIR: workspacePath,
    },
    stdio: "pipe",
  });

  dashboardServer.on("error", (error) => {
    console.error("[dashboard-server] spawn error", error);
  });
  dashboardServer.stderr?.on("data", (chunk) => {
    console.error("[dashboard-server]", chunk.toString());
  });
  dashboardServer.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(
        `[dashboard-server] exited early code=${code} signal=${signal ?? ""}`,
      );
    }
  });

  await waitForDashboardServer(port);
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

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
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
  dashboardPort = await spawnDashboardServer(workspacePath);
  createMainWindow(dashboardPort);
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && dashboardPort !== null) {
      createMainWindow(dashboardPort);
    }
  });
}).catch((error) => {
  console.error("[startup] failed", error);
  dialog.showErrorBox(
    "Advergaming Studio failed to start",
    error instanceof Error ? error.message : String(error),
  );
  app.quit();
});

app.on("before-quit", cleanupDashboardServer);
app.on("window-all-closed", () => {
  cleanupDashboardServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
