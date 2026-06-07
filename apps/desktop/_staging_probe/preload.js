const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_CHANNELS = new Set([
  "save-project-asset",
  "export-project",
  "save-flat-config",
  "load-flat-config",
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
