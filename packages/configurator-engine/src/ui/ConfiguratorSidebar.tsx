"use client";

import {
  exportClientPayload,
  type ControlFieldSchema,
  type ControlValue,
  type GameTemplateId,
} from "@advergaming/shared";
import { useMemo, useState } from "react";
import {
  getConfiguratorGameSchema,
  getProductionTemplateOptions,
} from "../registry/productionSchemaRegistry";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
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

export function ConfiguratorSidebar() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const selectedTemplateId = useConfiguratorStore((s) => s.selectedTemplateId);
  const setSelectedTemplateId = useConfiguratorStore((s) => s.setSelectedTemplateId);
  const config = useConfiguratorStore((s) => s.config);
  const patchBrandingPath = useConfiguratorStore((s) => s.patchBrandingPath);
  const resetBranding = useConfiguratorStore((s) => s.resetBranding);

  const templateOptions = useMemo(() => getProductionTemplateOptions(), []);
  const selectedTemplate = templateOptions.find((t) => t.id === selectedTemplateId);
  const gameSchema = getConfiguratorGameSchema(selectedTemplateId);

  const handleControlChange = (control: ControlFieldSchema, value: ControlValue) => {
    patchBrandingPath(control.targetPath, value);
  };

  const clientPayload = exportClientPayload(config);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Configurator</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Brand & localize — mechanics locked</p>
        </div>
        <button
          type="button"
          onClick={resetBranding}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Reset
        </button>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <Section title="Production Templates">
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
                  {selectedTemplate.author} · production
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

        <Section title="Diagnostics">
          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            className="w-full rounded-lg border border-zinc-200 py-2 text-sm hover:bg-zinc-50"
          >
            {showDiagnostics ? "Hide" : "View"} raw client payload
          </button>
          {showDiagnostics ? (
            <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
              {JSON.stringify(clientPayload, null, 2)}
            </pre>
          ) : null}
        </Section>
      </div>
    </aside>
  );
}
