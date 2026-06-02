"use client";

import { TemplateDetailsDialog } from "@/components/studio/TemplateDetailsDialog";
import type { TemplateManifest } from "@advergaming/shared";
import type { TemplatePickerOption } from "@advergaming/game-engine/templates/schemas";
import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const GAME_ENGINE_URL =
  process.env.NEXT_PUBLIC_GAME_ENGINE_URL ?? "http://localhost:5173";

export function TemplateListRow({
  template,
  onUpdated,
}: {
  template: TemplatePickerOption;
  onUpdated?: () => void;
}) {
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
          <Link
            href={`/studio?template=${encodeURIComponent(display.id)}`}
            className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-zinc-50"
          >
            <img
              src={`${GAME_ENGINE_URL}${display.previewUrl}${previewCacheBust ? `?t=${previewCacheBust}` : ""}`}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200/80 bg-zinc-50 object-cover shadow-sm"
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-zinc-900">{display.label}</span>
              <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                {display.id}
                {display.source === "development" ? " · dev" : ""} · v
                {display.version} · {display.status}
              </span>
              {display.description ? (
                <span className="mt-0.5 block truncate text-xs text-zinc-400">
                  {display.description}
                </span>
              ) : null}
            </span>
          </Link>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDetailsOpen(true);
            }}
            className="rounded-lg p-2 text-zinc-400 opacity-100 transition-all hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus:opacity-100"
            aria-label={`${display.label} options`}
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
      />
    </>
  );
}
