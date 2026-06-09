import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repoRoot = path.resolve(desktopRoot, "../..");
const nsisDir = path.join(desktopRoot, "nsis");
const sourceSection = path.join(nsisDir, "installSection.nsh");
const sourceUninstallPatch = path.join(nsisDir, "uninstallOldVersionPatch.nsh");

function findAppBuilderLibFile(...parts) {
  const direct = path.join(repoRoot, "node_modules", "app-builder-lib", ...parts);
  if (existsSync(direct)) {
    return direct;
  }

  const pnpmRoot = path.join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmRoot)) {
    return null;
  }

  for (const entry of readdirSync(pnpmRoot)) {
    if (!entry.startsWith("app-builder-lib@")) {
      continue;
    }
    const candidate = path.join(
      pnpmRoot,
      entry,
      "node_modules",
      "app-builder-lib",
      ...parts,
    );
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const destSection = findAppBuilderLibFile("templates", "nsis", "installSection.nsh");
const destInstallUtil = findAppBuilderLibFile("templates", "nsis", "include", "installUtil.nsh");

if (!destSection || !destInstallUtil) {
  console.error(
    "[apply-nsis-install-overrides] app-builder-lib NSIS templates not found. Run pnpm install.",
  );
  process.exit(1);
}

for (const required of [sourceSection, sourceUninstallPatch]) {
  if (!existsSync(required)) {
    console.error(`[apply-nsis-install-overrides] Missing ${required}`);
    process.exit(1);
  }
}

copyFileSync(sourceSection, destSection);
console.log(`[apply-nsis-install-overrides] applied ${sourceSection}`);
console.log(`  -> ${destSection}`);

const uninstallPatch = readFileSync(sourceUninstallPatch, "utf8").trimEnd() + "\n";

let installUtilText = readFileSync(destInstallUtil, "utf8");

const retryMarker = "  # Retry counter";
const start = installUtilText.indexOf(retryMarker);
const endMarker = "  DoesNotExist:";
const end = installUtilText.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  console.error("[apply-nsis-install-overrides] installUtil.nsh uninstallOldVersion tail not found");
  process.exit(1);
}

const endOfBlock = installUtilText.indexOf("    SetErrors", end);
if (endOfBlock === -1) {
  console.error("[apply-nsis-install-overrides] installUtil.nsh SetErrors not found");
  process.exit(1);
}

installUtilText =
  installUtilText.slice(0, start) + uninstallPatch + installUtilText.slice(endOfBlock);

writeFileSync(destInstallUtil, installUtilText, "utf8");
console.log("[apply-nsis-install-overrides] patched uninstallOldVersion (timed + Cancel aborts setup)");
console.log(`  -> ${destInstallUtil}`);
