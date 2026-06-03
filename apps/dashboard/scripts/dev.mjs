import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureLocalDevCacheJunction,
  localDevCacheRoot,
  shouldUseLocalDevCache,
} from "./local-dev-cache-dir.mjs";

const dashboardRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const monorepoRoot = path.resolve(dashboardRoot, "../..");

if (shouldUseLocalDevCache(monorepoRoot)) {
  ensureLocalDevCacheJunction(dashboardRoot);
  console.log(
    `[dev] Next dev cache on local disk (less AV churn on W:): ${localDevCacheRoot("dashboard-next")}`,
  );
}

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: dashboardRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      process.exitCode = code;
    }
  });
  return child;
}

const children = [];
const nextDev = run("next-dev", "pnpm", ["exec", "next", "dev"]);
children.push(nextDev);

if (process.env.MASHEDGAMES_WATCH_BRAND_LOGO === "1") {
  children.push(
    run("watch-brand-logo", process.execPath, [
      "scripts/watch-brand-logo.mjs",
    ]),
  );
}

function shutdown() {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
