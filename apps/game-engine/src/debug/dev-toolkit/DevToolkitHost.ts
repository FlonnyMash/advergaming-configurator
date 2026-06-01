import type { DebugOverlay, DebugOverlayFlags } from "../DebugOverlay.ts";

export interface DevToolkitHandle {
  destroy: () => void;
}

export function mountDevToolkit(overlay: DebugOverlay): DevToolkitHandle {
  const layer = document.getElementById("dev-toolkit-layer");
  if (!layer) {
    return { destroy: () => undefined };
  }

  layer.classList.remove("hidden");
  layer.classList.add("pointer-events-none");

  const panel = document.createElement("div");
  panel.className =
    "pointer-events-auto absolute top-3 right-3 z-[100] w-56 rounded-xl border border-zinc-600 bg-zinc-900/95 p-3 text-xs text-zinc-100 shadow-xl backdrop-blur";

  panel.innerHTML = `
    <p class="mb-2 font-semibold uppercase tracking-wide text-zinc-400">Dev Toolkit</p>
    <div class="space-y-2" id="dev-toolkit-toggles"></div>
  `;

  const toggles = panel.querySelector("#dev-toolkit-toggles")!;
  const flagKeys: (keyof DebugOverlayFlags)[] = [
    "hitboxes",
    "origins",
    "pivots",
    "physicsDebug",
  ];

  for (const key of flagKeys) {
    const label = document.createElement("label");
    label.className =
      "flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-zinc-800/80";
    const text = document.createElement("span");
    text.textContent = key;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "h-4 w-4 cursor-pointer accent-indigo-500";
    input.checked = overlay.getFlags()[key];
    input.addEventListener("change", () => {
      overlay.setFlags({ [key]: input.checked });
    });
    label.append(text, input);
    toggles.append(label);
  }

  layer.append(panel);

  return {
    destroy: () => {
      panel.remove();
      layer.classList.add("hidden");
    },
  };
}
