"use client";

import type { TemplateOverlayProps } from "./types";

export function LeadCaptureForm({ config, disabled }: TemplateOverlayProps) {
  const domOverlay = config.branding.domOverlay;

  if (!domOverlay.showLeadForm) {
    return null;
  }

  return (
    <div
      className={`pointer-events-auto absolute inset-x-4 bottom-6 z-20 rounded-xl border border-white/20 bg-zinc-900/90 p-4 text-white shadow-xl ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <p className="text-sm font-semibold">Stay in the loop</p>
      <p className="mt-1 text-xs text-zinc-400">Enter your email to get updates.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <input
          type="email"
          placeholder="you@brand.com"
          disabled={disabled}
          className="min-w-0 flex-1 rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs text-white placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={disabled}
          className="shrink-0 rounded-md bg-white px-3 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-50"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
