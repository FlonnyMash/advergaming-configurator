import {
  mergeBrandingPatch,
  type BrandingPatch,
  type GameMasterConfig,
} from "@mashedgames/shared";

export function applyBrandingPatch(
  current: GameMasterConfig,
  patch: BrandingPatch,
): GameMasterConfig {
  return mergeBrandingPatch(current, patch);
}

export function applyFullConfigInConfiguratorMode(
  incoming: GameMasterConfig,
  frozenSystem: GameMasterConfig["system"],
): GameMasterConfig {
  return {
    meta: { ...incoming.meta },
    system: structuredClone(frozenSystem),
    branding: structuredClone(incoming.branding),
  };
}
