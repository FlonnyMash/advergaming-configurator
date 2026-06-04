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

/** Template library on disk (Studio). Missing in packaged desktop — use registry fallback. */
export const templateLibraryRoot = (() => {
  const fromEnv = process.env.TEMPLATE_LIBRARY_ROOT?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(monorepoRoot, fromEnv);
  }
  return path.join(engineTemplatesRoot, "library");
})();

/** True when the monorepo template library folder is present (local dev / Studio). */
export function isMonorepoTemplateLibraryOnDisk(): boolean {
  return existsSync(templateLibraryRoot);
}
