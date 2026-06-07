import type { AppMode } from "@mashedgames/shared";

export function getAppMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  return mode === "configurator" ? "configurator" : "studio";
}

export function isStudioMode(): boolean {
  return getAppMode() === "studio";
}
