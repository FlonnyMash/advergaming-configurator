"use client";

import { getStudioGameSchema } from "../registry/studioSchemaRegistry";
import { useStudioConfigStore } from "../store/useStudioConfigStore";
import { SchemaControlPanel } from "./SchemaControlPanel";

export function StudioSidebar({
  previewSlot,
}: {
  previewSlot?: React.ReactNode;
}) {
  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const config = useStudioConfigStore((s) => s.config);
  const resetConfig = useStudioConfigStore((s) => s.resetConfig);
  const patchBrandingPath = useStudioConfigStore((s) => s.patchBrandingPath);
  const patchSystemPath = useStudioConfigStore((s) => s.patchSystemPath);

  const gameSchema = getStudioGameSchema(selectedTemplateId);

  const handleControlChange = (
    control: import("@advergaming/shared").ControlFieldSchema,
    value: import("@advergaming/shared").ControlValue,
  ) => {
    if (control.targetCategory === "system") {
      patchSystemPath(control.targetPath, value);
      return;
    }
    patchBrandingPath(control.targetPath, value);
  };

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Game controls</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Live tweaks for the preview
          </p>
        </div>
        <button
          type="button"
          onClick={resetConfig}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Reset
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <SchemaControlPanel
          schema={gameSchema}
          config={config}
          onControlChange={handleControlChange}
        />
        {previewSlot}
      </div>
    </aside>
  );
}
