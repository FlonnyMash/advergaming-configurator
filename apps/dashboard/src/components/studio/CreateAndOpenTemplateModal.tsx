"use client";

import { slugifyTemplateId, TEMPLATE_ID_PATTERN } from "@/lib/template-id";
import { Loader2, Plus, X } from "lucide-react";
import { useCallback, useId, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function CreateAndOpenTemplateModal({
  onCreated,
}: {
  onCreated: (templateId: string) => void;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const id = slugifyTemplateId(templateId || trimmedName);

    if (!trimmedName) {
      setError("Template name is required.");
      return;
    }
    if (!id || !TEMPLATE_ID_PATTERN.test(id)) {
      setError(
        "Template ID must be kebab-case (e.g. my-game), starting with a letter.",
      );
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/templates/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, templateId: id }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        templateId?: string;
      };

      if (!response.ok || !data.ok || !data.templateId) {
        throw new Error(data.error ?? "Could not create template.");
      }

      close();
      setName("");
      setTemplateId("");
      onCreated(data.templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create template.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        Create new template
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          role="presentation"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${formId}-title`}
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2
                  id={`${formId}-title`}
                  className="text-lg font-semibold text-zinc-900"
                >
                  Create new template
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Scaffolds a Phaser game under{" "}
                  <code className="rounded bg-zinc-100 px-1 text-xs">
                    templates/
                  </code>{" "}
                  and opens it in Studio.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <form
              className="space-y-4 px-6 py-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate();
              }}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Branded Game"
                  className={inputClass}
                  autoComplete="off"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Template ID
                </span>
                <input
                  type="text"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="my-branded-game"
                  className={inputClass}
                  autoComplete="off"
                />
                <span className="text-xs text-zinc-500">
                  Kebab-case folder name. Leave empty to derive from the name.
                </span>
              </label>

              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={creating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {creating ? "Creating…" : "Create and open"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
