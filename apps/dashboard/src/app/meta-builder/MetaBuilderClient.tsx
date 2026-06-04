"use client";

import { MetaBuilderPanel } from "@/components/meta-builder/MetaBuilderPanel";

export function MetaBuilderClient() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-5 py-4">
        <h1 className="text-base font-semibold text-zinc-900">Meta-Builder</h1>
        <p className="mt-1 text-xs text-zinc-500">
          White-label platform branding and license feature flags. Dev-only; stripped
          from production builds.
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-lg">
          <MetaBuilderPanel />
        </div>
      </main>
    </div>
  );
}
