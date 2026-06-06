import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Next dev/prod server cwd is apps/dashboard (or standalone/apps/dashboard).
 * Resolve monorepo paths from cwd — import.meta.url lands in .next chunks and
 * breaks relative monorepo resolution.
 */
const dashboardRoot = path.resolve(process.cwd());

/** Monorepo root (mashedgames-studio) */
export const monorepoRoot = path.resolve(dashboardRoot, "../..");

/** apps/game-engine — used for sync-manifest-registry spawn cwd */
export const gameEngineRoot = path.resolve(monorepoRoot, "apps/game-engine");

/** apps/game-engine/src/templates */
export const engineTemplatesRoot = path.resolve(
  gameEngineRoot,
  "src/templates",
);

/**
 * Unified template root on disk (Studio).
 * All templates live flat under this directory — no library/development split.
 * Override with TEMPLATE_LIBRARY_ROOT env var.
 * Missing in packaged desktop — use registry fallback.
 */
export const templateLibraryRoot = (() => {
  const fromEnv = process.env.TEMPLATE_LIBRARY_ROOT?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(monorepoRoot, fromEnv);
  }
  return engineTemplatesRoot;
})();

/** True when the monorepo template folder is present (local dev / Studio). */
export function isMonorepoTemplateLibraryOnDisk(): boolean {
  return existsSync(templateLibraryRoot);
}
