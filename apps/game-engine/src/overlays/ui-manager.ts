import type { GameMasterConfig } from "@advergaming/shared";
import { getDomOverlayForUi } from "@advergaming/shared";

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
export function updateUI(config: GameMasterConfig): void;
export function updateUI(config: UIConfig | GameMasterConfig): void {
  const ui = "branding" in config ? getDomOverlayForUi(config) : config;
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
