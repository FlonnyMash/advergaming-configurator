"use client";

import { DevToolkitPanel } from "@/components/studio/DevToolkitPanel";

export default function StudioDevToolsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-5 py-4">
        <h1 className="text-base font-semibold text-zinc-900">
          Studio Dev Toolkit
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Keep this window open beside Studio. Tools apply to the game preview in
          the main window.
        </p>
      </header>
      <main className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <DevToolkitPanel relayToGame={false} showPopoutButton={false} />
        </div>
      </main>
    </div>
  );
}
