const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn, spawnSync } = require("node:child_process");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  net,
  protocol,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const getPort = require("get-port");
const {
  APP_DISPLAY_NAME,
  PROJECTS_DIR_NAME,
  WORKSPACE_DIR_NAME,
  LEGACY_WORKSPACE_DIR_NAME,
  STUDIO_ASSET_PROTOCOL,
  PROJECT_ID_PATTERN,
} = require("./constants");
const { saveProjectAsset } = require("./asset-ipc-utils");
const {
  exportProjectToZip,
  resolveBundledEngineDir,
} = require("./export-ipc-utils");
const { saveFlatConfig, loadFlatConfig, getProjectList } = require("./flat-config-ipc-utils");
const { registerAuthIpc, getSessionForInternal } = require("./auth-ipc-utils");
const { registerLicenseIpc } = require("./license-ipc-utils");

const STUDIO_PROTOCOL = STUDIO_ASSET_PROTOCOL;
const STUDIO_PROTOCOL_PREFIX = `${STUDIO_PROTOCOL}://`;

let mainWindow = null;
let splashWindow = null;
let dashboardServer = null;
let dashboardPort = null;
let dashboardServerLog = "";
let dashboardServerExitCode = null;
let errorDialogShown = false;

function getMainProcessLogPath() {
  try {
    return path.join(app.getPath("userData"), "main-process-error.log");
  } catch {
    return path.join(process.cwd(), "main-process-error.log");
  }
}

function getElectronBinaryPathHint() {
  const releaseFile = path.resolve(
    app.getAppPath(),
    "..",
    "..",
    "node_modules",
    ".pnpm",
    "electron@31.7.7",
    "node_modules",
    "electron",
    "dist",
    process.platform === "win32" ? "electron.exe" : "electron",
  );
  return releaseFile;
}

function appendMainProcessLog(message) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.appendFileSync(getMainProcessLogPath(), `${new Date().toISOString()} ${message}\n`);
  } catch (error) {
    console.error("[error-log] failed to write main process log", error);
  }
}

function formatErrorForLog(error) {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  return String(error);
}

function showFatalErrorDialog(title, error) {
  if (errorDialogShown) {
    return;
  }
  errorDialogShown = true;
  const message = error instanceof Error ? error.message : String(error);
  const details = `A fatal startup/runtime error occurred.\n\nLog file:\n${getMainProcessLogPath()}\n\nError:\n${message}`;
  dialog.showMessageBoxSync({
    type: "error",
    title,
    message: title,
    detail: details,
    buttons: ["Close"],
    noLink: true,
  });
}

function reportFatalError(source, error) {
  const printable = formatErrorForLog(error);
  console.error(`[fatal:${source}]`, printable);
  appendMainProcessLog(`[${source}] ${printable}`);
  showFatalErrorDialog(`${APP_DISPLAY_NAME} encountered a fatal error`, error);
}

function validateElectronRuntimeBinary() {
  if (app.isPackaged) {
    return;
  }
  const binaryHint = getElectronBinaryPathHint();
  if (!fs.existsSync(binaryHint)) {
    const message = `Electron runtime binary missing at ${binaryHint}. Reinstall dependencies with 'pnpm install'.`;
    appendMainProcessLog(`[electron-runtime] ${message}`);
    throw new Error(message);
  }
}

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
  const appPath = app.getAppPath();
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
    appPath,
    "..",
    "dashboard",
    ".next",
    "standalone",
    "apps",
    "dashboard",
    "server.js",
  );
}

function resolveDesktopAssetPath(...segments) {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), ...segments);
  }
  return path.join(__dirname, ...segments);
}

function getAdvergamingWorkspacePath() {
  const documents = app.getPath("documents");
  const workspacePath = path.join(documents, WORKSPACE_DIR_NAME);
  const legacyWorkspacePath = path.join(
    documents,
    LEGACY_WORKSPACE_DIR_NAME,
  );

  if (
    fs.existsSync(legacyWorkspacePath) &&
    !fs.existsSync(workspacePath)
  ) {
    return legacyWorkspacePath;
  }

  return workspacePath;
}

function getProjectsPath(workspacePath) {
  return path.join(workspacePath, PROJECTS_DIR_NAME);
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

function isSafeProjectRelativeAssetPath(relativePath) {
  if (!relativePath || relativePath.includes("..")) {
    return false;
  }
  const normalized = relativePath.replace(/^\//, "").replace(/\\/g, "/");
  return normalized.startsWith("assets/");
}

function resolveRelativeStudioProtocolPath(requestUrl, workspacePath) {
  let parsed;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${STUDIO_PROTOCOL}:`) {
    return null;
  }

  const projectId = parsed.searchParams.get("project");
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return null;
  }

  let relativePath = parsed.pathname;
  try {
    relativePath = decodeURIComponent(relativePath);
  } catch {
    return null;
  }

  if (relativePath.startsWith("/")) {
    relativePath = relativePath.slice(1);
  }

  relativePath = relativePath.replace(/\\/g, "/");
  if (!isSafeProjectRelativeAssetPath(relativePath)) {
    return null;
  }

  const resolved = path.normalize(
    path.join(workspacePath, PROJECTS_DIR_NAME, projectId, relativePath),
  );

  if (!isPathInsideWorkspace(resolved, workspacePath)) {
    return null;
  }

  return resolved;
}

function resolveStudioProtocolRequest(requestUrl, workspacePath) {
  const relativeResolved = resolveRelativeStudioProtocolPath(
    requestUrl,
    workspacePath,
  );
  if (relativeResolved) {
    return relativeResolved;
  }

  return absolutePathFromStudioProtocolUrl(requestUrl);
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

function registerSaveProjectAssetIpc(workspacePath) {
  ipcMain.handle("save-project-asset", async (_event, payload) =>
    saveProjectAsset(workspacePath, payload),
  );
}

function registerSaveFlatConfigIpc(workspacePath) {
  ipcMain.handle("save-flat-config", (_event, payload) =>
    saveFlatConfig(workspacePath, payload),
  );
}

function registerLoadFlatConfigIpc(workspacePath) {
  ipcMain.handle("load-flat-config", (_event, payload) =>
    loadFlatConfig(workspacePath, payload),
  );
}

function registerGetProjectListIpc(workspacePath) {
  ipcMain.handle("get-project-list", (_event) =>
    getProjectList(workspacePath),
  );
}

async function fetchProjectExportConfigJson(projectId, port) {
  const url = `http://127.0.0.1:${port}/api/projects/${encodeURIComponent(projectId)}/export-config`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || !data?.ok || typeof data.configJson !== "string") {
    const message =
      typeof data?.error === "string"
        ? data.error
        : `Export config request failed (${response.status}).`;
    throw new Error(message);
  }

  return data.configJson;
}

function registerExportProjectIpc(workspacePath, getDashboardPort) {
  ipcMain.handle("export-project", async (_event, payload) => {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload.");
    }

    const { projectId } = payload;
    if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
      throw new Error("Invalid project ID.");
    }

    const port = getDashboardPort();
    if (port === null || port === undefined) {
      throw new Error("Dashboard server is not ready.");
    }

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${projectId}-export.zip`,
      filters: [{ name: "Zip archive", extensions: ["zip"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    const configJson = await fetchProjectExportConfigJson(projectId, port);
    const engineDir = resolveBundledEngineDir(app);
    const result = await exportProjectToZip({
      workspacePath,
      engineDir,
      destZipPath: filePath,
      configJson,
      projectId,
    });

    return { ok: true, savePath: path.normalize(result.savePath) };
  });
}

function registerStudioProtocol(workspacePath) {
  protocol.handle(STUDIO_PROTOCOL, async (request) => {
    if (!request.url.startsWith(STUDIO_PROTOCOL_PREFIX)) {
      return new Response("Bad Request", {
        status: 400,
        headers: { "content-type": "text/plain" },
      });
    }

    const filePath = resolveStudioProtocolRequest(request.url, workspacePath);
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

async function waitForHttpReady(urls, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await Promise.all(urls.map((url) => probeUrl(url)));
    if (ready.every(Boolean)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`HTTP readiness timeout for: ${urls.join(", ")}`);
}

function appendDashboardServerLog(chunk) {
  dashboardServerLog = (dashboardServerLog + chunk.toString()).slice(-8000);
}

function formatDashboardServerFailure(port, timeoutSeconds) {
  const logSuffix = dashboardServerLog.trim()
    ? `\n\nServer log:\n${dashboardServerLog.trim()}`
    : "";

  if (dashboardServerExitCode !== null) {
    return `Dashboard server exited with code ${dashboardServerExitCode} before becoming ready on port ${port}.${logSuffix}`;
  }

  return `Dashboard server did not become ready on port ${port} within ${timeoutSeconds}s (checked / and /engine/index.html).${logSuffix}`;
}

async function waitForDashboardServer(port) {
  const timeoutMs = app.isPackaged ? 90_000 : 30_000;
  const deadline = Date.now() + timeoutMs;
  const urls = [
    `http://127.0.0.1:${port}/`,
    `http://127.0.0.1:${port}/engine/index.html`,
  ];

  while (Date.now() < deadline) {
    if (dashboardServerExitCode !== null) {
      throw new Error(
        formatDashboardServerFailure(port, timeoutMs / 1000),
      );
    }

    const ready = await Promise.all(urls.map((url) => probeUrl(url)));
    if (ready.every(Boolean)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(formatDashboardServerFailure(port, timeoutMs / 1000));
}

async function waitForExternalDashboardServer(baseUrl) {
  const timeoutMs = 180_000;
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const urls = [`${normalizedBase}/`, `${normalizedBase}/engine/index.html`];
  await waitForHttpReady(urls, timeoutMs);
}

function buildDashboardServerEnv(workspaceBasePath, port) {
  return {
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    MASHEDGAMES_WORKSPACE_PATH: workspaceBasePath,
    NEXT_PUBLIC_WORKSPACE_DESKTOP: "1",
    NEXT_PUBLIC_ENV: "prod",
    NEXT_PUBLIC_BUNDLED_TEMPLATES: "catch-game-demo",
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    PATH: process.env.PATH,
  };
}

async function spawnDashboardServer(workspaceBasePath) {
  try {
    const port = await getPort();
    const serverEntry = resolveStandaloneServerPath();
    if (!fs.existsSync(serverEntry)) {
      throw new Error(`Dashboard standalone server not found: ${serverEntry}`);
    }

    dashboardServerLog = "";
    dashboardServerExitCode = null;

    dashboardServer = spawn(process.execPath, [serverEntry], {
      cwd: path.dirname(serverEntry),
      env: buildDashboardServerEnv(workspaceBasePath, port),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    dashboardServer.on("error", (error) => {
      const printable = formatErrorForLog(error);
      appendMainProcessLog(`[dashboard-server-spawn-error] ${printable}`);
      console.error("[dashboard-server] spawn error", error);
    });
    dashboardServer.stdout?.on("data", (chunk) => {
      appendDashboardServerLog(chunk);
      appendMainProcessLog(`[dashboard-server:stdout] ${chunk.toString().trimEnd()}`);
      console.log("[dashboard-server]", chunk.toString());
    });
    dashboardServer.stderr?.on("data", (chunk) => {
      appendDashboardServerLog(chunk);
      appendMainProcessLog(`[dashboard-server:stderr] ${chunk.toString().trimEnd()}`);
      console.error("[dashboard-server]", chunk.toString());
    });
    dashboardServer.on("exit", (code, signal) => {
      dashboardServerExitCode = code ?? 1;
      appendMainProcessLog(
        `[dashboard-server-exit] code=${String(code)} signal=${String(signal ?? "")}`,
      );
      if (code !== 0 && code !== null) {
        console.error(
          `[dashboard-server] exited early code=${code} signal=${signal ?? ""}`,
        );
      }
    });

    await waitForDashboardServer(port);
    return port;
  } catch (error) {
    reportFatalError("dashboard-server", error);
    throw error;
  }
}

function resolveSplashAssetPath(...segments) {
  return resolveDesktopAssetPath(...segments);
}

function createSplashWindow() {
  const splashHtml = resolveSplashAssetPath("splash.html");
  if (!fs.existsSync(splashHtml)) {
    console.warn("[splash] splash.html not found, skipping splash screen");
    return;
  }

  splashWindow = new BrowserWindow({
    width: 440,
    height: 340,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#fafafa",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile(splashHtml);
  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function closeSplashWindow() {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }
  splashWindow.close();
}

function attachMainWindowNavigationGuards(window, allowedOrigin) {
  const allowedOriginWithSlash = `${allowedOrigin}/`;

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(allowedOrigin)) {
      console.warn("[navigation] blocked main-frame navigation to", url);
      event.preventDefault();
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(allowedOrigin)) {
      return { action: "allow" };
    }
    console.warn("[navigation] blocked popup to", url);
    return { action: "deny" };
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }
      console.error(
        "[navigation] main frame failed to load",
        errorCode,
        errorDescription,
        validatedURL,
      );
      if (validatedURL.startsWith(allowedOrigin)) {
        return;
      }
      window.loadURL(allowedOriginWithSlash);
    },
  );
}

function createMainWindow(port) {
  const dashboardUrlBase = process.env.MASHEDGAMES_DASHBOARD_URL?.replace(/\/+$/, "");
  const mainWindowUrl = dashboardUrlBase
    ? `${dashboardUrlBase}/`
    : `http://127.0.0.1:${port}/`;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: resolveDesktopAssetPath("preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    closeSplashWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  const allowedOrigin = dashboardUrlBase
    ? new URL(mainWindowUrl).origin
    : `http://127.0.0.1:${port}`;
  attachMainWindowNavigationGuards(mainWindow, allowedOrigin);
  mainWindow.loadURL(mainWindowUrl);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }
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

function killProcessTree(childProcess) {
  if (!childProcess || childProcess.killed) {
    return;
  }

  const pid = childProcess.pid;
  if (typeof pid !== "number") {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(pid)], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }

  try {
    childProcess.kill("SIGKILL");
  } catch (error) {
    console.error("[shutdown] Failed to kill dashboard server:", error);
    try {
      process.kill(pid, "SIGKILL");
    } catch (fallbackError) {
      console.error("[shutdown] Fallback process.kill failed:", fallbackError);
    }
  }
}

function cleanupDashboardServer() {
  killProcessTree(dashboardServer);
  dashboardServer = null;
}

app.whenReady().then(async () => {
  createSplashWindow();

  try {
    validateElectronRuntimeBinary();
    const workspacePath = getAdvergamingWorkspacePath();
    ensureWorkspaceStructure(workspacePath);
    registerSaveProjectAssetIpc(workspacePath);
    registerExportProjectIpc(workspacePath, () => dashboardPort);
    registerSaveFlatConfigIpc(workspacePath);
    registerLoadFlatConfigIpc(workspacePath);
    registerGetProjectListIpc(workspacePath);
    await registerAuthIpc();
    registerLicenseIpc(getSessionForInternal);
    registerStudioProtocol(workspacePath);
    autoMigrateLegacyProjects(getProjectsPath(workspacePath));
    const externalDashboardUrl = process.env.MASHEDGAMES_DASHBOARD_URL;
    if (externalDashboardUrl) {
      await waitForExternalDashboardServer(externalDashboardUrl);
      const parsedUrl = new URL(externalDashboardUrl);
      dashboardPort = parsedUrl.port ? Number(parsedUrl.port) : 80;
      createMainWindow(dashboardPort);
    } else {
      dashboardPort = await spawnDashboardServer(workspacePath);
      createMainWindow(dashboardPort);
    }
    setupAutoUpdater();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && dashboardPort !== null) {
        createMainWindow(dashboardPort);
      }
    });
  } catch (error) {
    closeSplashWindow();
    reportFatalError("startup", error);
    throw error;
  }
}).catch((error) => {
  reportFatalError("startup-catch", error);
  app.quit();
});

process.on("uncaughtException", (error) => {
  reportFatalError("uncaughtException", error);
  cleanupDashboardServer();
  app.quit();
});

process.on("unhandledRejection", (reason) => {
  reportFatalError("unhandledRejection", reason);
  cleanupDashboardServer();
  app.quit();
});

app.on("before-quit", cleanupDashboardServer);
app.on("window-all-closed", () => {
  cleanupDashboardServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
