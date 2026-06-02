import {
  getAppEnvironmentFromProcess,
  type AppEnvironment,
} from "@advergaming/game-engine/templates/schemas";

export function getAppEnv(): AppEnvironment {
  return getAppEnvironmentFromProcess(process.env.NEXT_PUBLIC_ENV);
}

export function isDevEnv(): boolean {
  return getAppEnv() === "dev";
}
