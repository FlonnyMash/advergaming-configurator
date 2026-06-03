const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { app, BrowserWindow, dialog, net, protocol } = require("electron");
const { autoUpdater } = require("electron-updater");
const getPort = require("get-port");

const STUDIO_PROTOCOL = "mashedgames-studio";
const STUDIO_PROTOCOL_PREFIX = `${STUDIO_PROTOCOL}://`;

let mainWindow = null;
let dashboardServer = null;
let dashboardPort = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: STUDIO_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

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

function getAdvergamingWorkspacePath() {
  return path.join(app.getPath("documents"), "AdvergamingStudio");
}

function getProjectsPath(workspacePath) {
  return path.join(workspacePath, "Projects");
}

function ensureWorkspaceStructure(workspacePath) {
  const projectsPath = getProjectsPath(workspacePath);
  try {
    fs.mkdirSync(projectsPath, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create workspace at "${projectsPath}": ${message}`,
    );
  }
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

function absolutePathFromStudioProtocolUrl(requestUrl) {
  let parsed;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${STUDIO_PROTOCOL}:`) {
    return null;
  }

  let filePath;
  if (parsed.hostname && /^[a-zA-Z]$/.test(parsed.hostname)) {
    filePath = `${parsed.hostname}:${parsed.pathname}`;
  } else if (parsed.hostname) {
    filePath = `//${parsed.hostname}${parsed.pathname}`;
  } else {
    filePath = parsed.pathname;
  }

  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    return null;
  }

  if (process.platform === "win32" && /^\/[a-zA-Z]:/.test(filePath)) {
    filePath = filePath.slice(1);
  }

  filePath = path.normalize(filePath);
  if (!path.isAbsolute(filePath)) {
    return null;
  }

  return filePath;
}

function isPathInsideWorkspace(filePath, workspacePath) {
  const resolvedFile = path.resolve(filePath);
  const resolvedWorkspace = path.resolve(workspacePath);
  const relative = path.relative(resolvedWorkspace, resolvedFile);
  if (!relative || relative === "") {
    return true;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return true;
}

function registerStudioProtocol(workspacePath) {
  protocol.handle(STUDIO_PROTOCOL, async (request) => {
    if (!request.url.startsWith(STUDIO_PROTOCOL_PREFIX)) {
      return new Response("Bad Request", {
        status: 400,
        headers: { "content-type": "text/plain" },
      });
    }

    const filePath = absolutePathFromStudioProtocolUrl(request.url);
    if (!filePath) {
      return new Response("Bad Request", {
        status: 400,
        headers: { "content-type": "text/plain" },
      });
    }

    if (!isPathInsideWorkspace(filePath, workspacePath)) {
      return new Response("Forbidden", {
        status: 403,
        headers: { "content-type": "text/plain" },
      });
    }

    if (!fs.existsSync(filePath)) {
      return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (error) {
      console.error("[studio-protocol] stat failed", filePath, error);
      return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    if (!stat.isFile()) {
      return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    try {
      return await net.fetch(pathToFileURL(filePath).href);
    } catch (error) {
      console.error("[studio-protocol] fetch failed", filePath, error);
      return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }
  });
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

async function spawnDashboardServer(workspaceBasePath) {
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
      ADVERGAMING_WORKSPACE_PATH: workspaceBasePath,
      NEXT_PUBLIC_WORKSPACE_DESKTOP: "1",
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
  const workspacePath = getAdvergamingWorkspacePath();
  ensureWorkspaceStructure(workspacePath);
  registerStudioProtocol(workspacePath);
  autoMigrateLegacyProjects(getProjectsPath(workspacePath));
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
