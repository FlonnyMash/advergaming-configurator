"use client";

import { useGameChromeOverlayStore } from "@/lib/game-chrome-overlay-store";

function OverlayToggle({
  label,
  checked,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-700">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            checked ? "bg-indigo-500" : "bg-zinc-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </label>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function GameChromeOverlayPanel() {
  const overlays = useGameChromeOverlayStore((state) => state.overlays);
  const setOverlayUserVisible = useGameChromeOverlayStore(
    (state) => state.setOverlayUserVisible,
  );

  if (overlays.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 space-y-3 border-t border-zinc-200 pt-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Game overlays
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Transparent controls rendered on top of the game canvas.
        </p>
      </div>
      <div className="space-y-4">
        {overlays.map((overlay) => (
          <OverlayToggle
            key={overlay.id}
            label={overlay.label}
            checked={overlay.userVisible}
            hint={
              overlay.available
                ? undefined
                : "Available during gameplay preview"
            }
            onChange={(visible) =>
              setOverlayUserVisible(overlay.id, visible)
            }
          />
        ))}
      </div>
    </section>
  );
}
