"use client";

import type { TemplateOverlayProps } from "./types";

export function LeadCaptureForm({ config, disabled }: TemplateOverlayProps) {
  if (config.showLeadCapture === false) return null;

  const accentColor = config.themeColor ?? "#6366f1";

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-6">
      <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="mb-1 text-base font-semibold text-white">You did it!</h3>
        <p className="mb-4 text-xs text-zinc-400">Enter your details to save your score.</p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your name"
            disabled={disabled}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 disabled:opacity-50"
            style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
          />
          <input
            type="email"
            placeholder="Email address"
            disabled={disabled}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 disabled:opacity-50"
            style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
          />
          <button
            type="button"
            disabled={disabled}
            className="w-full rounded-lg py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
