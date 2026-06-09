const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_CHANNELS = new Set([
  "save-project-asset",
  "export-project",
  "save-flat-config",
  "load-flat-config",
  "get-project-list",
  "auth:login",
  "auth:logout",
  "auth:get-status",
  "auth:get-profile",
  "admin:publish-template",
  "admin:ref-data",
  "admin:provision-license",
  "license:check-eligibility",
  "store:load-catalog",
]);

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    invoke(channel, payload) {
      if (!ALLOWED_CHANNELS.has(channel)) {
        return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
      }
      return ipcRenderer.invoke(channel, payload);
    },
  },
});

// The dev-store-preview flag may arrive via two channels:
//  1. process.env  — set at OS level or inherited from main-process env at
//                    renderer-process spawn time.
//  2. process.argv — injected via BrowserWindow.webPreferences.additionalArguments
//                    by main.js after loadDevRuntimeOverride() runs; this is the
//                    reliable path for packaged builds where env mutations in
//                    the main process are not guaranteed to propagate to the
//                    renderer subprocess.
const devStorePreviewActive =
  process.env.MASHEDGAMES_DEV_STORE_PREVIEW === "1" ||
  process.argv.includes("--mashed-dev-store-preview");

contextBridge.exposeInMainWorld("mashedRuntime", {
  devStorePreview: devStorePreviewActive,
  usesExternalDashboard: Boolean(process.env.MASHEDGAMES_DASHBOARD_URL?.trim()),
});
