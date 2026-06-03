import path from "node:path";
import { fileURLToPath } from "node:url";

/** apps/dashboard/src/lib */
const libDir = path.dirname(fileURLToPath(import.meta.url));

/** apps/dashboard */
const dashboardRoot = path.resolve(libDir, "../..");

/** Monorepo root (mashedgames-studio) */
const monorepoRoot = path.resolve(dashboardRoot, "../..");

/** apps/game-engine — used for sync-manifest-registry spawn cwd */
export const gameEngineRoot = path.resolve(monorepoRoot, "apps/game-engine");

/** apps/game-engine/src/templates */
export const engineTemplatesRoot = path.resolve(
  gameEngineRoot,
  "src/templates",
);

/**
 * Template library on disk (Studio). Resolved from this module path so Next
 * file tracing does not treat `process.cwd()` as the whole repo root.
 */
export const templateLibraryRoot = (() => {
  const fromEnv = process.env.TEMPLATE_LIBRARY_ROOT?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(monorepoRoot, fromEnv);
  }
  return path.join(engineTemplatesRoot, "library");
})();
