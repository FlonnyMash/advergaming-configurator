"use client";

import { getDomOverlayForUi } from "@mashedgames/shared";
import type { TemplateOverlayProps } from "./types";

export function HighscoreTable({ config, disabled }: TemplateOverlayProps) {
  const domOverlay = getDomOverlayForUi(config);

  if (!domOverlay.showHighscores) {
    return null;
  }

  const entries = [
    { name: "Player 1", score: 1200 },
    { name: "Player 2", score: 980 },
    { name: "Player 3", score: 640 },
  ];

  return (
    <div
      className={`pointer-events-auto absolute right-3 top-14 z-20 w-40 rounded-lg border border-white/20 bg-black/70 p-3 text-left text-white shadow-lg ${
        disabled ? "opacity-60" : ""
      }`}
      aria-label="High scores"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
        High scores
      </p>
      <ul className="space-y-1 text-xs">
        {entries.map((row) => (
          <li key={row.name} className="flex justify-between gap-2">
            <span className="truncate text-zinc-200">{row.name}</span>
            <span className="font-medium tabular-nums">{row.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
