"use client";

import type { ControlFieldSchema, ControlValue } from "@mashedgames/shared";
import { getConfiguratorGameSchema } from "../registry/productionSchemaRegistry";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import {
  SchemaControlPanel,
  type ImageUploadMode,
} from "./SchemaControlPanel";

export function ConfiguratorSidebar({
  previewSlot,
  imageUploadMode = "base64",
  onImageFile,
}: {
  previewSlot?: React.ReactNode;
  imageUploadMode?: ImageUploadMode;
  onImageFile?: (
    file: File,
    control: ControlFieldSchema,
  ) => void | Promise<void>;
}) {
  const selectedTemplateId = useConfiguratorStore((s) => s.selectedTemplateId);
  const config = useConfiguratorStore((s) => s.config);
  const patchBrandingPath = useConfiguratorStore((s) => s.patchBrandingPath);
  const resetBranding = useConfiguratorStore((s) => s.resetBranding);
  const uploadBrandingAsset = useConfiguratorStore((s) => s.uploadBrandingAsset);

  const gameSchema = getConfiguratorGameSchema(selectedTemplateId);

  const handleControlChange = (control: ControlFieldSchema, value: ControlValue) => {
    patchBrandingPath(control.targetPath, value);
  };

  const handleImageFile =
    onImageFile ??
    (imageUploadMode === "workspace-file"
      ? (file: File, control: ControlFieldSchema) => uploadBrandingAsset(file, control)
      : undefined);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Brand controls</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Customize the live preview — mechanics locked
          </p>
        </div>
        <button
          type="button"
          onClick={resetBranding}
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
          imageUploadMode={imageUploadMode}
          onImageFile={handleImageFile}
          categoryFilter="branding"
        />
        {previewSlot}
      </div>
    </aside>
  );
}
