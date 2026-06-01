import type { AppMode } from "@advergaming/shared";

/** Studio vs configurator — URL param overrides Vite env (iframe can pass ?appMode=studio). */
export function getEngineMode(): AppMode {
  const fromUrl = new URLSearchParams(window.location.search).get("appMode");
  if (fromUrl === "studio" || fromUrl === "configurator") {
    return fromUrl;
  }
  const mode = import.meta.env.VITE_APP_MODE;
  return mode === "configurator" ? "configurator" : "studio";
}

export function allowsSystemMutation(): boolean {
  return getEngineMode() === "studio";
}
