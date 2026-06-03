/**
 * Watches public/mashed-games-logo.png and regenerates desktop ICO/BMP on save.
 */
import { existsSync, watch } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BRAND_LOGO_FILENAME = "mashed-games-logo.png";

const dashboardRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const logoPath = path.join(dashboardRoot, "public", BRAND_LOGO_FILENAME);
const watchTarget = path.join(dashboardRoot, "public");
const brandingScript = path.join(
  dashboardRoot,
  "..",
  "desktop",
  "scripts",
  "sync-installer-branding.mjs",
);

if (!existsSync(logoPath)) {
  console.warn(
    "[watch-brand-logo] No logo yet at public/mashed-games-logo.png — watching folder…",
  );
}

let debounceTimer = null;

function syncDesktopIcons(reason) {
  if (!existsSync(logoPath)) {
    return;
  }
  console.log(`[watch-brand-logo] ${reason} — syncing desktop icons…`);
  const result = spawnSync(process.execPath, [brandingScript], {
    stdio: "inherit",
    cwd: path.join(dashboardRoot, "..", "desktop"),
  });
  if (result.status !== 0) {
    console.error("[watch-brand-logo] sync failed");
  }
}

watch(watchTarget, { persistent: true }, (eventType, filename) => {
  if (filename && filename !== BRAND_LOGO_FILENAME) {
    return;
  }
  if (eventType !== "change" && eventType !== "rename") {
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => syncDesktopIcons("Logo file saved"), 400);
});

console.log(
  "[watch-brand-logo] Watching public/mashed-games-logo.png (save to sync desktop icons)",
);
