"use client";

import type { TemplateManifest } from "@mashedgames/shared";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  PHASE_HELPER_TEXT,
  patchTemplatePhase,
  phaseBadgeClass,
  phaseToggleLabel,
  phaseToggleTitle,
} from "@/lib/template-phase-ui";

export type TemplatePhaseControlProps = {
  templateId: string;
  /** Authoritative status from server or catalog; resets local override when changed. */
  status: TemplateManifest["status"];
  onStatusChanged?: (manifest: TemplateManifest) => void;
  /** When true, hides the section heading (e.g. inside a dialog field group). */
  embedded?: boolean;
};

export function TemplatePhaseControl({
  templateId,
  status: serverStatus,
  onStatusChanged,
  embedded = false,
}: TemplatePhaseControlProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<TemplateManifest["status"] | null>(
    null,
  );

  useEffect(() => {
    setLocalStatus(null);
    setError(null);
  }, [templateId, serverStatus]);

  const status = localStatus ?? serverStatus;
  const helperText = PHASE_HELPER_TEXT[status];

  const toggleStatus = useCallback(async () => {
    const next: TemplateManifest["status"] =
      status === "published" ? "draft" : "published";

    setSaving(true);
    setError(null);
    setLocalStatus(next);

    const result = await patchTemplatePhase(templateId, next);

    if (!result.ok) {
      setLocalStatus(null);
      setError(result.error ?? "Update failed.");
      setSaving(false);
      return;
    }

    setLocalStatus(result.manifest?.status ?? next);
    if (result.manifest && onStatusChanged) {
      onStatusChanged(result.manifest as TemplateManifest);
    }
    setSaving(false);
  }, [onStatusChanged, status, templateId]);

  return (
    <div className={embedded ? "space-y-2" : "space-y-3"}>
      {!embedded ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Phase
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <span
          title={helperText}
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${phaseBadgeClass(status)}`}
        >
          {status}
        </span>
        <button
          type="button"
          title={phaseToggleTitle(status)}
          onClick={() => void toggleStatus()}
          disabled={saving}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
        >
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Updating…
            </span>
          ) : (
            phaseToggleLabel(status)
          )}
        </button>
      </div>
      <p
        key={status}
        className="text-xs leading-relaxed text-zinc-500"
        aria-live="polite"
      >
        {helperText}
      </p>
      {error ? (
        <p className="text-[11px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
