import {
  getAppEnvironmentFromProcess,
  type AppEnvironment,
} from "@mashedgames/game-engine/templates/schemas";
import path from "node:path";

export function getAppEnv(): AppEnvironment {
  return getAppEnvironmentFromProcess(process.env.NEXT_PUBLIC_ENV);
}

export function isDevEnv(): boolean {
  return getAppEnv() === "dev";
}

/**
 * Root OS-level workspace for user projects and assets.
 * In Electron production, injected via MASHEDGAMES_WORKSPACE_PATH at spawn time.
 * During plain `next dev`, falls back to a repo-local folder to avoid touching Documents.
 */
export function getWorkspacePath(): string {
  const fromEnv = process.env.MASHEDGAMES_WORKSPACE_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(process.cwd(), ".local-workspace");
}
