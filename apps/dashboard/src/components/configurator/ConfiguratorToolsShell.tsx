"use client";

import { CloudflareDeployButton } from "@/components/configurator/CloudflareDeployButton";
import { ExportGameButton } from "@/components/configurator/ExportGameButton";
import { ExitConfiguratorProjectButton } from "@/components/configurator/ExitConfiguratorProjectButton";
import { SaveProjectButton } from "@/components/configurator/SaveProjectButton";
import { OpenProjectLocationButtons } from "@/components/shell/OpenProjectLocationButtons";
import { useConfiguratorStore } from "@mashedgames/configurator-engine";

export function ConfiguratorToolsShell() {
  const projectId = useConfiguratorStore((state) => state.projectId);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-zinc-900">Workspace</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Project save and export</p>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        {projectId ? (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Project folder
            </p>
            <OpenProjectLocationButtons kind="project" id={projectId} />
          </section>
        ) : null}
        <SaveProjectButton />
        <ExportGameButton />
        <CloudflareDeployButton />
        <ExitConfiguratorProjectButton />
      </div>
    </aside>
  );
}
