"use client";

import { normalizeGameMasterConfig } from "@advergaming/shared";
import { useRef, useState } from "react";
import { useStudioConfigStore } from "../store/useStudioConfigStore";

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

export function StudioConfigJsonTools() {
  const jsonImportInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const setConfig = useStudioConfigStore((s) => s.setConfig);

  return (
    <Section title="Config snapshot">
      <p className="text-xs leading-relaxed text-zinc-500">
        Export or import the full game configuration JSON for the selected
        template (backup, sharing, or bulk edits).
      </p>
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
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "studio-config.json";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
          className="flex-1 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => jsonImportInputRef.current?.click()}
          className="flex-1 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Import JSON
        </button>
      </div>
      {importError ? (
        <p className="text-xs text-red-600" role="alert">
          {importError}
        </p>
      ) : null}
    </Section>
  );
}
