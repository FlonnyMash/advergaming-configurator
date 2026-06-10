import type { GameConfig } from "@mashedgames/shared";

let overlayRoot: HTMLElement | null = null;

function getOverlayRoot(): HTMLElement {
  if (!overlayRoot) {
    overlayRoot = document.getElementById("ui-layer");
  }
  if (!overlayRoot) {
    throw new Error("Missing #ui-layer overlay mount point.");
  }
  return overlayRoot;
}

export function initOverlayShell(): void {
  const root = getOverlayRoot();
  if (root.dataset.mounted === "true") {
    return;
  }
  root.dataset.mounted = "true";
  root.className = "pointer-events-none absolute inset-0 z-10";
}

export function applyOverlayConfig(config: GameConfig): void {
  initOverlayShell();
  const root = getOverlayRoot();
  root.style.setProperty("--theme-color", config.themeColor);
  document.documentElement.style.setProperty("--theme-color", config.themeColor);
}
