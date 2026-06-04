import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopDistDir = path.join(dashboardRoot, "..", "desktop", "dist");

const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_WORKSPACE_DESKTOP: "1",
  NEXT_PUBLIC_ENV: "prod",
  NEXT_PUBLIC_BUNDLED_TEMPLATES: "catch-game-demo",
};

function resolveNextCli() {
  const candidates = [
    path.join(dashboardRoot, "node_modules", "next", "dist", "bin", "next"),
    path.join(dashboardRoot, "node_modules", "next", "dist", "bin", "next.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `Could not find Next.js CLI under ${path.join(dashboardRoot, "node_modules", "next")}. Run pnpm install.`,
  );
}

function run(execPath, args) {
  const result = spawnSync(execPath, args, {
    cwd: dashboardRoot,
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (fs.existsSync(desktopDistDir)) {
  console.log(
    `[build-desktop] Removing ${desktopDistDir} so it is not traced into standalone output.`,
  );
  fs.rmSync(desktopDistDir, { recursive: true, force: true });
}

run(process.execPath, [resolveNextCli(), "build"]);
run(process.execPath, [
  path.join(dashboardRoot, "scripts", "sync-standalone-assets.mjs"),
]);
