"use client";

import { generateTemplateZip } from "@/lib/template-generator";
import { Download, FolderArchive, X } from "lucide-react";
import { useCallback, useId, useState } from "react";

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function slugifyTemplateId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function CreateTemplateModal() {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const handleGenerate = async () => {
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

    setGenerating(true);
    setError(null);

    try {
      const blob = await generateTemplateZip({ name: trimmedName, templateId: id });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${id}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      close();
      setName("");
      setTemplateId("");
    } catch {
      setError("Could not generate the template archive. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
      >
        <FolderArchive className="h-4 w-4 shrink-0" aria-hidden />
        New game template
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
                  Create game template
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Generates a Phaser scaffold plus{" "}
                  <code className="rounded bg-zinc-100 px-1 text-xs">CURSOR.md</code>{" "}
                  with integration instructions for AI-assisted development.
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
                void handleGenerate();
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
                disabled={generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {generating ? "Generating…" : "Generate template"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
