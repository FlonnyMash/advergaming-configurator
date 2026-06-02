import type Phaser from "phaser";
import "../catch-game-overlay.css";
import { setupUIManager, type UIManager } from "./ui/UIManager";

const CATCH_UI_MARKER = "data-catch-game-ui";
const CATCH_SHELL_ID = "catch-game-shell";
const CATCH_STAGE_ID = "catch-game-stage";

const TOUCH_PAD_HTML = `
  <div id="touch-zone" class="touch-controls__pad" role="slider" aria-label="Move player" tabindex="0">
    <div id="touch-indicator" class="touch-controls__thumb" aria-hidden="true"></div>
  </div>
`;

const TOUCH_CONTROLS_HTML = `
  <p class="touch-controls__hint">Slide to move the player</p>
  ${TOUCH_PAD_HTML}
`;

const UI_LAYER_HTML = `
    <section
      id="ui-start"
      class="pointer-events-auto flex flex-1 flex-col items-center justify-center gap-6 bg-slate-950/80 px-6 text-center"
      aria-label="Start screen"
    >
      <div class="flex flex-col gap-3">
        <h1 class="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          Catch &amp; Win
        </h1>
        <p class="max-w-xs text-base leading-relaxed text-slate-400">
          Catch items to unlock your reward
        </p>
      </div>
      <button
        id="btn-play"
        type="button"
        class="min-h-12 w-full max-w-xs rounded-xl bg-slate-100 px-8 py-3.5 text-base font-medium text-slate-900 transition-colors hover:bg-white active:bg-slate-200"
      >
        Play Now
      </button>
    </section>

    <section
      id="ui-hud"
      class="pointer-events-none hidden w-full items-start justify-between gap-2 p-3"
      aria-label="Game HUD"
    >
      <div class="rounded-lg bg-slate-900/70 px-3 py-2 backdrop-blur-sm">
        <div class="flex items-baseline gap-2">
          <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Score</span>
          <span id="hud-score" class="text-lg font-semibold tabular-nums text-slate-50">0</span>
        </div>
        <div class="mt-1 flex items-baseline gap-2 border-t border-slate-700/50 pt-1">
          <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Time</span>
          <span id="hud-timer" class="text-lg font-semibold tabular-nums text-slate-50">0:30</span>
        </div>
      </div>
      <button
        id="btn-debug-freeze"
        type="button"
        hidden
        class="pointer-events-auto shrink-0 rounded-lg border border-amber-500/60 bg-amber-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber-200"
      >
        Freeze
      </button>
    </section>

    <section
      id="ui-gameover"
      class="pointer-events-none hidden flex-1 items-center justify-center bg-slate-950/80 px-4 py-8"
      aria-label="Game over"
      role="dialog"
      aria-modal="true"
    >
      <div class="pointer-events-auto w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md">
        <p class="text-center text-sm font-medium uppercase tracking-wider text-zinc-500">Final Score</p>
        <p id="final-score" class="mt-1 text-center text-4xl font-semibold tabular-nums text-slate-50">0</p>
        <button
          id="btn-retry"
          type="button"
          class="mt-6 min-h-12 w-full rounded-xl border border-slate-500 bg-transparent px-6 py-3.5 text-base font-medium text-slate-100"
        >
          Try Again
        </button>
        <p class="mt-6 text-center text-sm text-slate-400">Enter your email to claim your exclusive discount.</p>
        <form id="lead-form" class="mt-4 flex flex-col gap-4">
          <label for="lead-email" class="sr-only">Email</label>
          <input
            id="lead-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            class="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 text-base text-slate-100"
          />
          <button type="submit" class="min-h-12 w-full rounded-xl bg-slate-100 px-6 py-3.5 text-base font-medium text-slate-900">
            Claim 15% Off
          </button>
        </form>
      </div>
    </section>
  `;

function ensureCatchGameShell(
  gameContainer: HTMLElement,
  uiLayer: HTMLElement,
): HTMLElement {
  let shell = document.getElementById(CATCH_SHELL_ID);
  if (shell) {
    return shell;
  }

  shell = document.createElement("div");
  shell.id = CATCH_SHELL_ID;
  shell.className = "catch-game-shell";

  const stage = document.createElement("div");
  stage.id = CATCH_STAGE_ID;
  stage.className = "catch-game-stage";

  const touchRoot = document.createElement("aside");
  touchRoot.id = "touch-controls";
  touchRoot.className = "touch-controls";
  touchRoot.setAttribute("aria-hidden", "true");
  touchRoot.setAttribute("aria-label", "Player controls");
  touchRoot.innerHTML = TOUCH_CONTROLS_HTML;

  document.body.insertBefore(shell, gameContainer);
  stage.appendChild(gameContainer);
  stage.appendChild(uiLayer);
  stage.appendChild(touchRoot);
  shell.appendChild(stage);

  document.documentElement.classList.add("catch-game-active");
  document.body.classList.add("catch-game-active");

  return shell;
}

function restoreDefaultLayout(): void {
  const shell = document.getElementById(CATCH_SHELL_ID);
  if (!shell) return;

  const gameContainer = document.getElementById("game-container");
  const uiLayer = document.getElementById("ui-layer");
  const touchControls = document.getElementById("touch-controls");

  if (gameContainer) {
    gameContainer.className = "absolute inset-0 z-0";
    document.body.insertBefore(gameContainer, shell);
  }
  if (uiLayer) {
    uiLayer.className =
      "absolute inset-0 z-10 pointer-events-none transition-opacity duration-300";
    uiLayer.innerHTML = "";
    uiLayer.removeAttribute(CATCH_UI_MARKER);
    document.body.insertBefore(uiLayer, shell);
  }

  touchControls?.remove();
  shell.remove();

  document.documentElement.classList.remove("catch-game-active");
  document.body.classList.remove("catch-game-active");
}

export function mountCatchGameOverlay(): void {
  const gameContainer = document.getElementById("game-container");
  const uiLayer = document.getElementById("ui-layer");
  if (!gameContainer || !uiLayer) {
    throw new Error("mountCatchGameOverlay: #game-container or #ui-layer not found");
  }

  ensureCatchGameShell(gameContainer, uiLayer);

  uiLayer.setAttribute(CATCH_UI_MARKER, "true");
  uiLayer.innerHTML = UI_LAYER_HTML;

  const notifyResize = () => {
    window.dispatchEvent(new Event("resize"));
  };
  requestAnimationFrame(notifyResize);
  requestAnimationFrame(() => requestAnimationFrame(notifyResize));
  window.setTimeout(notifyResize, 0);
  window.setTimeout(notifyResize, 150);
}

export function unmountCatchGameOverlay(): void {
  restoreDefaultLayout();
}

export function initCatchGameUi(
  game: Phaser.Game,
  debugModeEnabled = false,
): UIManager {
  mountCatchGameOverlay();
  return setupUIManager(game, { debugModeEnabled });
}
