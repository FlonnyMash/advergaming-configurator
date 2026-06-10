"use client";

import type { TemplateOverlayProps } from "./types";

const PLACEHOLDER_SCORES = [
  { rank: 1, name: "Player 1", score: 9800 },
  { rank: 2, name: "Player 2", score: 7400 },
  { rank: 3, name: "Player 3", score: 5100 },
];

export function HighscoreTable({ config }: TemplateOverlayProps) {
  if (config.showHighscore === false) return null;

  const accentColor = config.themeColor ?? "#6366f1";

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 w-64 -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-black/70 backdrop-blur-sm">
      <p
        className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: accentColor }}
      >
        Highscores
      </p>
      <ul className="divide-y divide-white/10">
        {PLACEHOLDER_SCORES.map(({ rank, name, score }) => (
          <li key={rank} className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-white/50">#{rank}</span>
            <span className="text-xs font-medium text-white">{name}</span>
            <span className="text-xs font-semibold" style={{ color: accentColor }}>
              {score.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
