"use client";

import type { GameTemplateId } from "@mashedgames/shared";
import { resolveTemplatePreviewUrl } from "@mashedgames/shared";
import { useMemo } from "react";
import { getStudioTemplateOptions } from "../registry/studioSchemaRegistry";
import { useStudioConfigStore } from "../store/useStudioConfigStore";
import { controlInputClass } from "./SchemaControlPanel";

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

export interface StudioTemplateCatalogProps {
  catalogEnv?: "dev" | "prod";
}

export function StudioTemplateCatalog({
  catalogEnv = "dev",
}: StudioTemplateCatalogProps) {
  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const setSelectedTemplateId = useStudioConfigStore((s) => s.setSelectedTemplateId);

  const templateOptions = useMemo(
    () => getStudioTemplateOptions(catalogEnv),
    [catalogEnv],
  );
  const selectedTemplate = templateOptions.find((t) => t.id === selectedTemplateId);

  return (
    <Section title="Template catalog">
      <select
        value={selectedTemplateId}
        onChange={(e) => setSelectedTemplateId(e.target.value as GameTemplateId)}
        className={controlInputClass}
      >
        {templateOptions.map((template) => (
          <option key={template.id} value={template.id}>
            {template.label}
            {template.status === "draft" ? " (draft)" : ""}
          </option>
        ))}
      </select>
      {selectedTemplate ? (
        <div className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <img
            src={resolveTemplatePreviewUrl(selectedTemplate.previewUrl)}
            alt={`${selectedTemplate.label} preview`}
            className="h-16 w-16 shrink-0 rounded-md border border-zinc-200 bg-white object-cover"
          />
          <div className="min-w-0 space-y-1 text-xs text-zinc-600">
            <p className="font-medium text-zinc-900">
              {selectedTemplate.label}{" "}
              <span className="font-normal text-zinc-500">
                v{selectedTemplate.version}
              </span>
              <span
                className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  selectedTemplate.status === "published"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {selectedTemplate.status}
              </span>
            </p>
            {selectedTemplate.description ? (
              <p className="line-clamp-2">{selectedTemplate.description}</p>
            ) : null}
            <p>
              {selectedTemplate.author} · {selectedTemplate.status}
            </p>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
