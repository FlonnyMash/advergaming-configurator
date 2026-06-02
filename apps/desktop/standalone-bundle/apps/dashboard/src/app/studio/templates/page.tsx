"use client";

import { CreateTemplateModal } from "@/components/studio/CreateTemplateModal";
import { ImportTemplateModal } from "@/components/studio/ImportTemplateModal";
import { TemplateListRow } from "@/components/studio/TemplateListRow";
import { getAppEnv } from "@/lib/env";
import { getStudioTemplateOptions } from "@advergaming/studio-engine";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

export default function StudioTemplatesPage() {
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

  const templateOptions = useMemo(
    () => getStudioTemplateOptions(getAppEnv()),
    [catalogRefreshKey],
  );

  const handleTemplateInstalled = useCallback(() => {
    setCatalogRefreshKey((key) => key + 1);
    window.location.reload();
  }, []);

  const handleTemplateUpdated = useCallback(() => {
    setCatalogRefreshKey((key) => key + 1);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 overflow-y-auto p-8">
      <header>
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-800">
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Studio templates
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Open a game template to edit mechanics and defaults, or add a new one
          to the library under{" "}
          <code className="text-xs">apps/game-engine/src/templates/</code>.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Template packages</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Generate a scaffold zip or install an archive into the repo. Template
          IDs must match the folder name (kebab-case).
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <CreateTemplateModal />
          </div>
          <div className="min-w-0 flex-1">
            <ImportTemplateModal onInstalled={handleTemplateInstalled} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900">Open existing</h2>
        {templateOptions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No templates in the catalog yet. Import one above or run{" "}
            <code className="text-xs">sync-manifest-registry</code> after adding
            files.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {templateOptions.map((template) => (
              <TemplateListRow
                key={template.id}
                template={template}
                onUpdated={handleTemplateUpdated}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
