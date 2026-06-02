"use client";

import { DevToolkitMenu } from "@/components/studio/DevToolkitMenu";
import { CreateTemplateModal } from "@/components/studio/CreateTemplateModal";
import { ExportTemplateButton } from "@/components/studio/ExportTemplateButton";
import { ImportTemplateModal } from "@/components/studio/ImportTemplateModal";
import {
  StudioConfigJsonTools,
  StudioTemplateCatalog,
} from "@advergaming/studio-engine";

export interface StudioToolsPanelProps {
  catalogEnv?: "dev" | "prod";
}

export function StudioToolsPanel({ catalogEnv = "dev" }: StudioToolsPanelProps) {
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
        <StudioTemplateCatalog catalogEnv={catalogEnv} />
        <StudioConfigJsonTools />
      </div>

      <div className="shrink-0 space-y-3 border-t border-zinc-200 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Template packages
        </p>
        <CreateTemplateModal />
        <ImportTemplateModal />
        <ExportTemplateButton />
      </div>
    </aside>
  );
}
