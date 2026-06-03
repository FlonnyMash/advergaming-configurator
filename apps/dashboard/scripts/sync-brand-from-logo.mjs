/**
 * Regenerates desktop ICO/BMP when the manual logo PNG is newer than the outputs.
 * Logo source: apps/dashboard/public/mashed-games-logo.png
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const logoPath = path.join(dashboardRoot, "public", "mashed-games-logo.png");
const iconPath = path.join(
  dashboardRoot,
  "..",
  "desktop",
  "nsis",
  "icon.ico",
);
const brandingScript = path.join(
  dashboardRoot,
  "..",
  "desktop",
  "scripts",
  "sync-installer-branding.mjs",
);

if (!existsSync(logoPath)) {
  process.exit(0);
}

const logoMtime = statSync(logoPath).mtimeMs;
const iconMtime = existsSync(iconPath) ? statSync(iconPath).mtimeMs : 0;

if (logoMtime <= iconMtime) {
  process.exit(0);
}

console.log(
  "[sync-brand-from-logo] Logo changed — regenerating desktop icons from public/mashed-games-logo.png",
);

const result = spawnSync(process.execPath, [brandingScript], {
  stdio: "inherit",
  cwd: path.join(dashboardRoot, "..", "desktop"),
});

process.exit(result.status ?? 1);
