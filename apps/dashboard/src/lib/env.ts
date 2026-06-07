import { getAppEnvironmentFromProcess, type AppEnvironment } from "@/lib/app-environment";
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
 */
export function getWorkspacePath(): string {
  const fromEnv = process.env.MASHEDGAMES_WORKSPACE_PATH?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(process.cwd(), ".local-workspace");
}
