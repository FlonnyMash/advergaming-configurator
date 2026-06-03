"use client";

import type { TemplateOverlayProps } from "./types";

export function StartScreen({ config, messenger, disabled }: TemplateOverlayProps) {
  const domOverlay = config.branding.domOverlay;
  const title = domOverlay.startScreenTitle || "Play Now";
  const cta = domOverlay.ctaButtonText || "Start";

  const handleStart = () => {
    if (disabled) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("GAME_START"));
    }
    messenger?.sendGameEvent("GAME_START", {});
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 p-6 text-center">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <button
        type="button"
        disabled={disabled}
        onClick={handleStart}
        className="mt-6 rounded-full bg-white px-8 py-2.5 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100 disabled:opacity-50"
      >
        {cta}
      </button>
    </div>
  );
}
