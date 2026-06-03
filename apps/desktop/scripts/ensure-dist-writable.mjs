import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(desktopRoot, "dist");
const winUnpacked = path.join(distDir, "win-unpacked");

const RM_OPTS = { recursive: true, force: true, maxRetries: 5, retryDelay: 300 };

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isLockError(error) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "EBUSY" || error.code === "EPERM" || error.code === "EACCES")
  );
}

function stopWindowsDistLocks() {
  if (process.platform !== "win32" || !fs.existsSync(distDir)) {
    return;
  }

  const distSuffix = path.join("apps", "desktop", "dist");
  const distForward = distSuffix.replace(/\\/g, "/");
  const ps = [
    "$dist = [regex]::Escape('" + distForward + "')",
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue",
    "| Where-Object {",
    "  ($_.ExecutablePath -and $_.ExecutablePath -match $dist) -or",
    "  ($_.CommandLine -and $_.CommandLine -match $dist)",
    "}",
    "| ForEach-Object {",
    "  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
    "}",
  ].join(" ");

  try {
    execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" });
  } catch {
    // Best-effort unlock only.
  }
}

function shouldRemoveDistEntry(name, dirent) {
  if (dirent.isDirectory()) {
    return /^(win|mac|linux)-/i.test(name) || name === ".icon-icns";
  }

  if (!dirent.isFile()) {
    return false;
  }

  return /\.(exe|blockmap|yml|7z|zip|dmg|AppImage)$/i.test(name);
}

function removeDistEntry(fullPath, dirent) {
  if (dirent.isDirectory()) {
    fs.rmSync(fullPath, RM_OPTS);
    return;
  }

  fs.rmSync(fullPath, { force: true, maxRetries: 5, retryDelay: 300 });
}

function clearDistArtifacts() {
  if (!fs.existsSync(distDir)) {
    return;
  }

  for (const name of fs.readdirSync(distDir)) {
    const fullPath = path.join(distDir, name);
    let dirent;
    try {
      dirent = fs.lstatSync(fullPath);
    } catch {
      continue;
    }

    if (!shouldRemoveDistEntry(name, dirent)) {
      continue;
    }

    removeDistEntry(fullPath, dirent);
  }
}

function printLockHelp() {
  console.error(
    [
      "Cannot clear apps/desktop/dist before packaging.",
      "",
      "Another program is using files in that folder (often a leftover Setup .exe,",
      "Cursor with app.asar open, File Explorer preview, or a running Studio build).",
      "",
      "Fix:",
      "  1. Close any editor tabs under apps/desktop/dist/",
      "  2. Quit Mashed Games Studio if it is running",
      "  3. Delete dist\\*.exe manually if an installer build was interrupted",
      "  4. Close File Explorer windows showing dist\\",
      "  5. Run: pnpm build:desktop",
    ].join("\n"),
  );
}

for (let attempt = 0; attempt < 3; attempt += 1) {
  try {
    if (attempt === 0) {
      stopWindowsDistLocks();
    }

    clearDistArtifacts();

    if (fs.existsSync(winUnpacked)) {
      fs.rmSync(winUnpacked, RM_OPTS);
    }

    process.exit(0);
  } catch (error) {
    if (!isLockError(error)) {
      throw error;
    }

    if (attempt < 2) {
      stopWindowsDistLocks();
      sleep(500);
      continue;
    }

    printLockHelp();
    process.exit(1);
  }
}
