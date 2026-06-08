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
  "license:check-eligibility",
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

contextBridge.exposeInMainWorld("mashedRuntime", {
  devStorePreview: process.env.MASHEDGAMES_DEV_STORE_PREVIEW === "1",
  usesExternalDashboard: Boolean(process.env.MASHEDGAMES_DASHBOARD_URL?.trim()),
});
