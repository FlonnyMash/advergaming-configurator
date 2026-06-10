import type { GameConfig } from "@mashedgames/shared";
import { resolveTextureUrl } from "../bridge/asset-loader.ts";
import { getRuntimeAssets } from "../bridge/runtime-assets.ts";

const OVERLAY_START_EVENT = "overlay:game-start";

let overlayRoot: HTMLElement | null = null;
let titleEl: HTMLHeadingElement | null = null;
let subtitleEl: HTMLParagraphElement | null = null;
let ctaButton: HTMLButtonElement | null = null;
let logoEl: HTMLImageElement | null = null;
let startScreenEl: HTMLElement | null = null;

function getOverlayRoot(): HTMLElement {
  if (!overlayRoot) {
    overlayRoot = document.getElementById("ui-layer");
  }
  if (!overlayRoot) {
    throw new Error("Missing #ui-layer overlay mount point.");
  }
  return overlayRoot;
}

function mountOverlayShell(): void {
  const root = getOverlayRoot();
  if (root.dataset.mounted === "true") {
    return;
  }

  root.dataset.mounted = "true";
  root.className =
    "pointer-events-none absolute inset-0 z-10 flex items-center justify-center";

  startScreenEl = document.createElement("div");
  startScreenEl.className =
    "pointer-events-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/80 p-8 text-center shadow-2xl backdrop-blur";

  logoEl = document.createElement("img");
  logoEl.alt = "Brand logo";
  logoEl.className = "max-h-16 w-auto object-contain";

  titleEl = document.createElement("h1");
  titleEl.className = "text-2xl font-semibold text-white";

  subtitleEl = document.createElement("p");
  subtitleEl.className = "text-sm text-slate-300";

  ctaButton = document.createElement("button");
  ctaButton.type = "button";
  ctaButton.className =
    "rounded-full px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90";
  ctaButton.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent(OVERLAY_START_EVENT));
    if (startScreenEl) {
      startScreenEl.classList.add("hidden");
    }
  });

  startScreenEl.append(logoEl, titleEl, subtitleEl, ctaButton);
  root.append(startScreenEl);
}

export function initOverlayShell(): void {
  mountOverlayShell();
}

export function applyOverlayConfig(config: GameConfig): void {
  mountOverlayShell();
  const root = getOverlayRoot();

  root.style.setProperty("--theme-color", config.themeColor);
  document.documentElement.style.setProperty("--theme-color", config.themeColor);

  if (titleEl) {
    titleEl.textContent = config.startScreenTitle;
  }
  if (subtitleEl) {
    subtitleEl.textContent = config.startScreenSubtitle ?? "";
    subtitleEl.hidden = !config.startScreenSubtitle;
  }
  if (ctaButton) {
    ctaButton.textContent = config.ctaLabel;
    ctaButton.style.backgroundColor = config.themeColor;
  }

  if (logoEl) {
    const logoUrl = config.logoUrl?.trim() ?? "";
    if (logoUrl) {
      logoEl.src = resolveTextureUrl(logoUrl, {
        projectId: config.projectId,
        runtimeAssets: getRuntimeAssets(),
      });
      logoEl.hidden = !logoEl.src;
    } else {
      logoEl.removeAttribute("src");
      logoEl.hidden = true;
    }
  }
}

export function onOverlayGameStart(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(OVERLAY_START_EVENT, handler);
  return () => window.removeEventListener(OVERLAY_START_EVENT, handler);
}

export function showStartScreen(): void {
  startScreenEl?.classList.remove("hidden");
}

export function hideStartScreen(): void {
  startScreenEl?.classList.add("hidden");
}
