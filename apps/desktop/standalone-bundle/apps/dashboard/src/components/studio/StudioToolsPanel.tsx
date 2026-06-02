"use client";

import { OpenProjectLocationButtons } from "@/components/shell/OpenProjectLocationButtons";
import { DevToolkitMenu } from "@/components/studio/DevToolkitMenu";
import { ExitStudioTemplateButton } from "@/components/studio/ExitStudioTemplateButton";
import { ExportTemplateButton } from "@/components/studio/ExportTemplateButton";
import { StudioConfigJsonTools, useStudioConfigStore } from "@advergaming/studio-engine";

export function StudioToolsPanel() {
  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900">Workspace</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Templates, config files, and project tools
            </p>
          </div>
          <DevToolkitMenu />
        </div>
      </header>
      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project folder
          </p>
          <OpenProjectLocationButtons kind="template" id={selectedTemplateId} />
        </section>
        <StudioConfigJsonTools />
        <ExitStudioTemplateButton />
      </div>

      <div className="shrink-0 space-y-3 border-t border-zinc-200 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Export
        </p>
        <ExportTemplateButton />
      </div>
    </aside>
  );
}
