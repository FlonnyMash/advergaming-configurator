"use client";

import { TemplateDetailsDialog } from "@/components/studio/TemplateDetailsDialog";
import type { TemplateManifest } from "@mashedgames/shared";
import { resolveTemplatePreviewUrl } from "@mashedgames/shared";
import type { TemplatePickerOption } from "@mashedgames/game-engine/templates/schemas";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function TemplateListRow({
  template,
  onUpdated,
  onDeleted,
}: {
  template: TemplatePickerOption;
  onUpdated?: () => void;
  onDeleted?: (templateId: string) => void;
}) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [manifestOverride, setManifestOverride] =
    useState<Partial<TemplatePickerOption> | null>(null);
  const [previewCacheBust, setPreviewCacheBust] = useState(0);

  const display = useMemo(
    () => ({
      ...template,
      ...manifestOverride,
      label: manifestOverride?.label ?? template.label,
      description: manifestOverride?.description ?? template.description,
      status: manifestOverride?.status ?? template.status,
      version: manifestOverride?.version ?? template.version,
      previewUrl: manifestOverride?.previewUrl ?? template.previewUrl,
    }),
    [manifestOverride, template],
  );

  const previewSrc = resolveTemplatePreviewUrl(display.previewUrl, {
    cacheBust: previewCacheBust || undefined,
  });

  const openTemplate = () => {
    router.push(`/studio?template=${encodeURIComponent(display.id)}`);
  };

  const applyManifest = (manifest: TemplateManifest) => {
    setManifestOverride({
      label: manifest.label,
      description: manifest.description,
      status: manifest.status,
      version: manifest.version,
      previewUrl: manifest.previewUrl,
    });
    setPreviewCacheBust(Date.now());
    onUpdated?.();
  };

  return (
    <>
      <li className="group relative">
        <div className="flex items-center gap-2 pr-2">
          <button
            type="button"
            onClick={openTemplate}
            className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50"
          >
            <img
              src={previewSrc}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200/80 bg-zinc-50 object-cover shadow-sm"
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-zinc-900">{display.label}</span>
              <span
                className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                  display.status === "published"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {display.status}
              </span>
              <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                {display.id} · v{display.version}
              </span>
              {display.description ? (
                <span className="mt-0.5 block truncate text-xs text-zinc-400">
                  {display.description}
                </span>
              ) : null}
            </span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDetailsOpen(true);
            }}
            className="shrink-0 rounded-lg p-2 text-zinc-400 opacity-100 transition-all hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus:opacity-100"
            aria-label={`${display.label} details`}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </li>

      <TemplateDetailsDialog
        templateId={template.id}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onSaved={applyManifest}
        onDeleted={onDeleted}
      />
    </>
  );
}
