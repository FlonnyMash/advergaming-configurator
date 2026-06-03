import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: expected to include ${JSON.stringify(needle)}`);
  }
}

function assertExcludes(haystack, needle, label) {
  if (haystack.includes(needle)) {
    throw new Error(`${label}: must not include ${JSON.stringify(needle)}`);
  }
}

const checks = [
  () => {
    const preload = read("apps/desktop/preload.js");
    assertIncludes(preload, '"save-project-asset"', "preload channel whitelist");
    assertIncludes(preload, "contextBridge.exposeInMainWorld", "preload bridge");
  },
  () => {
    const main = read("apps/desktop/main.js");
    assertIncludes(main, 'preload: path.join(__dirname, "preload.js")', "main preload path");
    assertIncludes(main, 'ipcMain.handle("save-project-asset"', "main IPC handler");
    assertIncludes(main, "./asset-ipc-utils", "main uses asset-ipc-utils");
  },
  () => {
    const pkg = read("apps/desktop/package.json");
    assertIncludes(pkg, '"preload.js"', "desktop build bundles preload");
  },
  () => {
    const client = read("apps/dashboard/src/lib/save-asset-to-workspace.ts");
    assertIncludes(client, '"save-project-asset"', "IPC client invoke channel");
    assertIncludes(client, "window.electron?.ipcRenderer", "IPC client bridge guard");
  },
  () => {
    const fallback = read("apps/dashboard/src/lib/import-project-asset-client.ts");
    assertIncludes(fallback, "saveAssetToWorkspace", "fallback tries IPC first");
    assertIncludes(fallback, "/import-asset", "fallback API route");
    assertIncludes(fallback, "AssetWorkspaceSaveError", "fallback only on missing bridge");
  },
  () => {
    const workspace = read("apps/dashboard/src/components/configurator/ConfiguratorWorkspace.tsx");
    assertIncludes(workspace, "saveProjectAssetWithFallback", "workspace DI handler");
    assertIncludes(workspace, "pushRuntimeAssetsToPreview", "SET_RUNTIME_ASSETS wiring");
    assertIncludes(workspace, "sendLoadExternalAsset", "LOAD_EXTERNAL_ASSET wiring");
    assertIncludes(workspace, 'imageUploadMode = isWorkspaceDesktopClient()', "desktop upload mode");
    assertExcludes(workspace, "onImageFile=", "legacy onImageFile prop removed");
  },
  () => {
    const store = read("packages/configurator-engine/src/store/useConfiguratorStore.ts");
    assertIncludes(store, "assetSaveHandler", "store DI field");
    assertIncludes(store, "uploadBrandingAsset", "store upload orchestration");
    assertIncludes(store, "patchBrandingPath", "store branding patch");
  },
  () => {
    const sidebar = read("packages/configurator-engine/src/ui/ConfiguratorSidebar.tsx");
    assertIncludes(sidebar, "uploadBrandingAsset", "sidebar store upload");
    assertIncludes(sidebar, 'imageUploadMode === "workspace-file"', "sidebar workspace mode");
  },
  () => {
    const panel = read("packages/configurator-engine/src/ui/SchemaControlPanel.tsx");
    assertIncludes(panel, 'imageUploadMode === "workspace-file" && onImageFile', "panel workspace branch");
    assertIncludes(panel, "FileReader", "panel base64 branch for web dev");
    assertIncludes(panel, "image/svg+xml", "panel accepts svg for IPC parity");
  },
  () => {
    const bridge = read("apps/dashboard/src/store/useBridgeSync.ts");
    assertIncludes(bridge, "sendBridgePayload", "UPDATE_CONFIG via bridge sync");
    assertIncludes(bridge, "configUpdateMode", "branding-patch support");
  },
  () => {
    const preload = read("apps/desktop/preload.js");
    assertIncludes(preload, '"export-project"', "preload export channel whitelist");
  },
  () => {
    const main = read("apps/desktop/main.js");
    assertIncludes(main, 'ipcMain.handle("export-project"', "main export IPC handler");
    assertIncludes(main, "./export-ipc-utils", "main uses export-ipc-utils");
    assertIncludes(main, "showSaveDialog", "main export save dialog");
  },
  () => {
    const pkg = read("apps/desktop/package.json");
    assertIncludes(pkg, '"export-ipc-utils.js"', "desktop build bundles export-ipc-utils");
  },
  () => {
    const client = read("apps/dashboard/src/lib/export-project-client.ts");
    assertIncludes(client, '"export-project"', "export IPC client invoke channel");
    assertIncludes(client, "window.electron?.ipcRenderer", "export IPC bridge guard");
  },
  () => {
    const shell = read("apps/dashboard/src/components/configurator/ConfiguratorToolsShell.tsx");
    assertIncludes(shell, "ExportGameButton", "configurator tools export button");
  },
];

for (const check of checks) {
  check();
}

console.log(`Verified ${checks.length} Electron asset IPC wiring checks.`);
