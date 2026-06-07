"use client";
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
    if (!TEMPLATE_ID_PATTERN.test(id)) {
      setError("Use a lowercase kebab-case template id.");
      return;
    }

    setGenerating(true);
    setError(null);
    const response = await fetch("/api/templates/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        templateId: id,
      }),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };
    setGenerating(false);

    if (!response.ok || !result.ok) {
      setError(result.error ?? "Template creation failed.");
      return;
    }

    close();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
      >
        <FolderArchive className="h-4 w-4" aria-hidden />
        New template
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Create template</h2>
          <button type="button" onClick={close} aria-label="Close">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>
        <form
          id={formId}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleGenerate();
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-700">Display name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-700">Template id</span>
            <input
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              placeholder={slugifyTemplateId(name) || "my-template"}
              className={inputClass}
            />
          </label>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={generating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden />
            {generating ? "Creating…" : "Create template"}
          </button>
        </form>
      </div>
    </div>
  );
}
