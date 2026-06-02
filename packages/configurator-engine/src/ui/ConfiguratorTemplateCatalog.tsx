"use client";

import type { GameTemplateId } from "@advergaming/shared";
import { useMemo } from "react";
import { getProductionTemplateOptions } from "../registry/productionSchemaRegistry";
import { useConfiguratorStore } from "../store/useConfiguratorStore";
import { controlInputClass } from "./SchemaControlPanel";

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

export function ConfiguratorTemplateCatalog() {
  const selectedTemplateId = useConfiguratorStore((s) => s.selectedTemplateId);
  const setSelectedTemplateId = useConfiguratorStore((s) => s.setSelectedTemplateId);
  const projectMode = useConfiguratorStore((s) => s.projectMode);
  const projectManifest = useConfiguratorStore((s) => s.projectManifest);

  const templateOptions = useMemo(() => getProductionTemplateOptions(), []);
  const selectedTemplate = templateOptions.find((t) => t.id === selectedTemplateId);

  return (
    <Section title={projectMode ? "Parent template (read-only)" : "Production Templates"}>
      {projectMode ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Project <span className="font-medium">{projectManifest?.displayName}</span>{" "}
          inherits from{" "}
          <span className="font-mono">{projectManifest?.parentTemplateId}</span>
        </p>
      ) : (
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
      )}
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
  );
}
