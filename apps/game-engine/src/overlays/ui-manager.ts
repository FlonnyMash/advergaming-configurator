import type { GameConfig } from "@mashedgames/shared";
import { getDomOverlayForUi, getPrimaryBrandColor } from "@mashedgames/shared";
import { resolveTextureUrl } from "../bridge/asset-loader.ts";
import { getRuntimeAssets } from "../bridge/runtime-assets.ts";

export type UIConfig = ReturnType<typeof getDomOverlayForUi>;

let uiRoot: HTMLElement | null = null;
let startTitle: HTMLElement | null = null;
let ctaButton: HTMLButtonElement | null = null;
let leadForm: HTMLElement | null = null;
let highscores: HTMLElement | null = null;
let interactionsInitialized = false;

function ensureUI(): void {
  if (uiRoot) return;

  const layer = document.getElementById("ui-layer");
  if (!layer) {
    throw new Error("Missing #ui-layer element");
  }

  layer.innerHTML = `
    <div id="start-screen" class="flex h-full w-full items-center justify-center p-6">
      <div class="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-white/95 p-8 shadow-xl backdrop-blur-sm">
        <h1 id="start-title" class="text-center text-2xl font-bold tracking-tight text-zinc-900"></h1>
        <button
          id="cta-button"
          type="button"
          class="pointer-events-auto w-full rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
        ></button>
        <form id="lead-form" class="pointer-events-auto hidden w-full space-y-3 border-t border-zinc-200 pt-6">
          <p class="text-sm font-medium text-zinc-700">Join the leaderboard</p>
          <input
            type="text"
            placeholder="Name"
            class="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
          <input
            type="email"
            placeholder="Email"
            class="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        </form>
        <div id="highscores" class="hidden w-full border-t border-zinc-200 pt-6">
          <p class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Highscores</p>
          <ol class="space-y-2 text-sm text-zinc-800">
            <li class="flex justify-between"><span>1. Alex</span><span>12,400</span></li>
            <li class="flex justify-between"><span>2. Sam</span><span>9,850</span></li>
            <li class="flex justify-between"><span>3. Jordan</span><span>7,200</span></li>
          </ol>
        </div>
      </div>
    </div>
  `;

  uiRoot = layer;
  startTitle = layer.querySelector("#start-title");
  ctaButton = layer.querySelector("#cta-button");
  leadForm = layer.querySelector("#lead-form");
  highscores = layer.querySelector("#highscores");
}

export function updateUI(config: UIConfig): void;
export function updateUI(config: GameConfig): void;
export function updateUI(config: UIConfig | GameConfig): void {
  const ui: UIConfig =
    "startScreenTitle" in config && "primaryColor" in config
      ? (config as UIConfig)
      : getDomOverlayForUi(config as GameConfig);
  ensureUI();

  if (startTitle) {
    startTitle.textContent = ui.startScreenTitle;
  }

  if (ctaButton) {
    ctaButton.textContent = ui.ctaButtonText;
    ctaButton.style.backgroundColor = ui.primaryColor;
  }

  if (leadForm) {
    leadForm.classList.toggle("hidden", !ui.showLeadForm);
    leadForm.classList.toggle("block", ui.showLeadForm);
  }

  if (highscores) {
    highscores.classList.toggle("hidden", !ui.showHighscores);
    highscores.classList.toggle("block", ui.showHighscores);
  }
}

/**
 * Maps branding config to CSS variables and DOM nodes above the Phaser canvas.
 */
export function updateDomOverlays(config: GameConfig): void {
  const root = document.documentElement;
  const primaryColor = getPrimaryBrandColor(config);
  const secondaryColor =
    typeof config.secondaryColor === "string"
      ? config.secondaryColor
      : primaryColor;
  const fontFamily =
    typeof config.fontFamily === "string"
      ? config.fontFamily
      : "system-ui, sans-serif";

  root.style.setProperty("--theme-primary", primaryColor);
  root.style.setProperty("--theme-secondary", secondaryColor);
  root.style.setProperty("--theme-font-family", fontFamily);

  const logoUrl =
    config.logoUrl ??
    (typeof config.playerTexture === "string" ? config.playerTexture : null);

  const leadFormBackground = document.getElementById(
    "lead-form-bg",
  ) as HTMLImageElement | null;
  if (leadFormBackground && logoUrl) {
    leadFormBackground.src = resolveTextureUrl(logoUrl, {
      projectId: config.projectId,
      runtimeAssets: getRuntimeAssets(),
    });
  }

  updateUI(config);
}

/** Restore the default engine start overlay after a template-specific DOM mount. */
export function restoreEngineDefaultOverlay(): void {
  uiRoot = null;
  startTitle = null;
  ctaButton = null;
  leadForm = null;
  highscores = null;
  interactionsInitialized = false;
  ensureUI();
  initUIInteractions();
}

export function initUIInteractions(): void {
  if (interactionsInitialized) return;
  interactionsInitialized = true;

  ensureUI();

  ctaButton?.addEventListener("click", () => {
    uiRoot?.classList.add(
      "opacity-0",
      "pointer-events-none",
      "transition-opacity",
      "duration-300",
    );
    window.dispatchEvent(new Event("GAME_START"));
  });
}
