import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronCli = path.join(
  repoRoot,
  "apps",
  "desktop",
  "node_modules",
  "electron",
  "cli.js",
);
const desktopRoot = path.join(repoRoot, "apps", "desktop");
const dashboardUrl = process.env.MASHEDGAMES_DASHBOARD_URL ?? "http://127.0.0.1:3000";

const result = spawnSync(process.execPath, [electronCli, "."], {
  cwd: desktopRoot,
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    MASHEDGAMES_DASHBOARD_URL: dashboardUrl,
  },
});

process.exit(result.status ?? 1);
