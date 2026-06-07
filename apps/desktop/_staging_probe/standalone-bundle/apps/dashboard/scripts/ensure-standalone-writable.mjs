import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(dashboardRoot, ".next", "standalone");
const serverEntry = path.join(standaloneDir, "apps", "dashboard", "server.js");

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

function removeStandalone() {
  if (!fs.existsSync(standaloneDir)) {
    return;
  }
  fs.rmSync(standaloneDir, { recursive: true, force: true });
}

function stopWindowsStandaloneServers() {
  if (process.platform !== "win32" || !fs.existsSync(serverEntry)) {
    return;
  }

  const normalizedEntry = serverEntry.replace(/\\/g, "/");
  const ps = [
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\"",
    "| Where-Object {",
    `$_.CommandLine -like '*${normalizedEntry}*' -or`,
    `$_.CommandLine -like '*${normalizedEntry.replace(/\//g, "\\\\")}*'`,
    "}",
    "| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join(" ");

  try {
    execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" });
  } catch {
    // Best-effort unlock only.
  }
}

function printLockHelp() {
  console.error(
    [
      "Cannot clear apps/dashboard/.next/standalone before build.",
      "",
      "Another program is using that folder (often a leftover dashboard server.js,",
      "a running Mashed Games Studio build, or File Explorer preview).",
      "",
      "Fix:",
      "  1. Quit Mashed Games Studio if it is running",
      "  2. Stop any node process serving apps/dashboard/.next/standalone/.../server.js",
      "  3. Close File Explorer windows showing .next\\standalone",
      "  4. Run: pnpm build:desktop",
    ].join("\n"),
  );
}

for (let attempt = 0; attempt < 3; attempt += 1) {
  try {
    removeStandalone();
    process.exit(0);
  } catch (error) {
    if (!isLockError(error)) {
      throw error;
    }

    if (attempt === 0) {
      stopWindowsStandaloneServers();
    }

    if (attempt < 2) {
      sleep(500);
      continue;
    }

    printLockHelp();
    process.exit(1);
  }
}
