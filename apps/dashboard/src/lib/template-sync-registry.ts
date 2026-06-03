import { spawnSync } from "node:child_process";
import path from "node:path";

const dashboardRoot = path.resolve(process.cwd());
const gameEngineRoot = path.resolve(dashboardRoot, "../game-engine");
const syncScriptPath = path.join(
  gameEngineRoot,
  "scripts/sync-manifest-registry.ts",
);

export function runSyncManifestRegistry(): { ok: true } | { ok: false; error: string } {
  if (!gameEngineRoot || !syncScriptPath) {
    return { ok: false, error: "Game engine path is not configured." };
  }

  const tsxResult = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", syncScriptPath],
    {
      cwd: gameEngineRoot,
      encoding: "utf8",
      shell: false,
    },
  );

  if (tsxResult.status === 0) {
    return { ok: true };
  }

  const pnpmResult = spawnSync("pnpm", ["sync-manifest-registry"], {
    cwd: gameEngineRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (pnpmResult.status === 0) {
    return { ok: true };
  }

  const detail = (
    pnpmResult.stderr ||
    pnpmResult.stdout ||
    tsxResult.stderr ||
    tsxResult.stdout ||
    ""
  ).trim();

  return {
    ok: false,
    error: detail
      ? `Failed to sync manifest registry: ${detail}`
      : "Failed to sync manifest registry. Is apps/game-engine available?",
  };
}
