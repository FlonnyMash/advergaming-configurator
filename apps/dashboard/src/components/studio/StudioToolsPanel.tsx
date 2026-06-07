"use client";

import { OpenProjectLocationButtons } from "@/components/shell/OpenProjectLocationButtons";
import {
  WorkspaceProjectControls,
  type WorkspaceProjectControlsProps,
} from "@/components/shell/WorkspaceProjectControls";
import { ExitStudioTemplateButton } from "@/components/studio/ExitStudioTemplateButton";
import { useStudioConfigStore } from "@mashedgames/studio-engine";

export function StudioToolsPanel({
  availableProjects,
  onSave,
  onLoad,
}: WorkspaceProjectControlsProps) {
  const selectedTemplateId = useStudioConfigStore((state) => state.selectedTemplateId);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-zinc-900">Workspace</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Flat template configuration</p>
      </header>
      {(onSave ?? onLoad) ? (
        <div className="border-b border-zinc-200 px-6 py-4">
          <WorkspaceProjectControls
            availableProjects={availableProjects}
            onSave={onSave}
            onLoad={onLoad}
          />
        </div>
      ) : null}
      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Template folder
          </p>
          <OpenProjectLocationButtons kind="template" id={selectedTemplateId} />
        </section>
        <ExitStudioTemplateButton />
      </div>
    </aside>
  );
}
