"use client";

import { normalizeGameMasterConfig, type GameTemplateId } from "@advergaming/shared";
import { useMemo, useRef, useState } from "react";
import { getStudioGameSchema, getStudioTemplateOptions } from "../registry/studioSchemaRegistry";
import { useStudioConfigStore } from "../store/useStudioConfigStore";
import { controlInputClass, SchemaControlPanel } from "./SchemaControlPanel";

const GAME_ENGINE_URL =
  process.env.NEXT_PUBLIC_GAME_ENGINE_URL ?? "http://localhost:5173";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export interface StudioSidebarProps {
  catalogEnv?: "dev" | "prod";
}

export function StudioSidebar({ catalogEnv = "dev" }: StudioSidebarProps) {
  const jsonImportInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const setSelectedTemplateId = useStudioConfigStore((s) => s.setSelectedTemplateId);
  const config = useStudioConfigStore((s) => s.config);
  const setConfig = useStudioConfigStore((s) => s.setConfig);
  const resetConfig = useStudioConfigStore((s) => s.resetConfig);
  const patchBrandingPath = useStudioConfigStore((s) => s.patchBrandingPath);
  const setSystem = useStudioConfigStore((s) => s.setSystem);

  const templateOptions = useMemo(
    () => getStudioTemplateOptions(catalogEnv),
    [catalogEnv],
  );
  const selectedTemplate = templateOptions.find((t) => t.id === selectedTemplateId);
  const gameSchema = getStudioGameSchema(selectedTemplateId);

  const handleControlChange = (
    control: import("@advergaming/shared").ControlFieldSchema,
    value: import("@advergaming/shared").ControlValue,
  ) => {
    if (control.targetCategory === "system") {
      const system = structuredClone(config.system) as unknown as Record<
        string,
        unknown
      >;
      const parts = control.targetPath.split(".");
      let current = system;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]!;
        if (typeof current[key] !== "object" || current[key] === null) {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]!] = value;
      setSystem(system as unknown as typeof config.system);
      return;
    }
    patchBrandingPath(control.targetPath, value);
  };

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Advergaming Studio</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Mechanics, assets, and branding
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

      <div className="border-b border-zinc-200 px-6 py-4">
        <input
          ref={jsonImportInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = normalizeGameMasterConfig(
                  JSON.parse(reader.result as string),
                  selectedTemplateId,
                );
                if (!parsed) {
                  setImportError("Invalid config JSON.");
                  return;
                }
                setConfig(parsed);
                setImportError(null);
              } catch {
                setImportError("Could not parse JSON.");
              }
              event.target.value = "";
            };
            reader.readAsText(file);
          }}
        />
        <div className="flex overflow-hidden rounded-lg border border-zinc-200 divide-x divide-zinc-200">
          <button
            type="button"
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify(useStudioConfigStore.getState().config, null, 2)],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "studio-config.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex-1 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => jsonImportInputRef.current?.click()}
            className="flex-1 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Import
          </button>
        </div>
        {importError ? (
          <p className="mt-2 text-xs text-red-600">{importError}</p>
        ) : null}
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <Section title="Template Catalog">
          <select
            value={selectedTemplateId}
            onChange={(e) =>
              setSelectedTemplateId(e.target.value as GameTemplateId)
            }
            className={controlInputClass}
          >
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
                {template.source === "development" ? " (dev)" : ""}
              </option>
            ))}
          </select>
          {selectedTemplate ? (
            <div className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <img
                src={`${GAME_ENGINE_URL}${selectedTemplate.previewUrl}`}
                alt={`${selectedTemplate.label} preview`}
                className="h-16 w-16 shrink-0 rounded-md border border-zinc-200 bg-white object-cover"
              />
              <div className="min-w-0 space-y-1 text-xs text-zinc-600">
                <p className="font-medium text-zinc-900">
                  {selectedTemplate.label}{" "}
                  <span className="font-normal text-zinc-500">
                    v{selectedTemplate.version}
                  </span>
                </p>
                {selectedTemplate.description ? (
                  <p className="line-clamp-2">{selectedTemplate.description}</p>
                ) : null}
                <p>
                  {selectedTemplate.author} · {selectedTemplate.status}
                  {selectedTemplate.source === "development"
                    ? " · development"
                    : " · library"}
                </p>
              </div>
            </div>
          ) : null}
        </Section>

        <SchemaControlPanel
          schema={gameSchema}
          config={config}
          onControlChange={handleControlChange}
        />
      </div>
    </aside>
  );
}
