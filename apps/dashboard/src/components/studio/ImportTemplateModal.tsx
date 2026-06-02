"use client";

import type { ImportProgressEvent } from "@/lib/template-import-events";
import { CheckCircle2, Loader2, Terminal, Upload, X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

type LogLine = {
  id: number;
  kind: "info" | "command" | "error" | "success";
  text: string;
  detail?: string;
};

export function ImportTemplateModal({
  onInstalled,
}: {
  onInstalled?: (templateId: string) => void;
}) {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [overwritePrompt, setOverwritePrompt] = useState<{
    templateId: string;
  } | null>(null);

  const appendLog = useCallback(
    (kind: LogLine["kind"], text: string, detail?: string) => {
      const id = ++logIdRef.current;
      setLogs((prev) => [...prev, { id, kind, text, detail }]);
      requestAnimationFrame(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    },
    [],
  );

  const close = useCallback(() => {
    if (importing) return;
    setOpen(false);
    setError(null);
    setSuccess(null);
    setLogs([]);
    setActiveStep(null);
    setOverwritePrompt(null);
  }, [importing]);

  const resetForm = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleProgressEvent = useCallback(
    (event: ImportProgressEvent) => {
      if (event.type === "progress") {
        setActiveStep(event.step);
        appendLog("info", event.message, event.detail);
        if (event.command) {
          appendLog("command", event.command, event.detail);
        }
        return;
      }

      if (event.type === "error") {
        setActiveStep(null);
        appendLog("error", event.error);
        setError(event.error);
        return;
      }

      if (event.type === "done") {
        setActiveStep(null);
        appendLog("success", `Installation complete: ${event.templateId}`);
        const modeNote =
          event.status === "RAW_CONVERTED"
            ? " (legacy project converted)"
            : "";
        setSuccess(
          `Installed "${event.templateId}"${modeNote}. Refresh the page; restart the game engine dev server if the preview does not load the new template.`,
        );
        resetForm();
        onInstalled?.(event.templateId);
      }
    },
    [appendLog, onInstalled, resetForm],
  );

  const runImport = async (overwrite: boolean) => {
    if (!file) {
      setError("Select a .zip template archive first.");
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);
    setOverwritePrompt(null);
    setLogs([]);
    setActiveStep("upload");
    logIdRef.current = 0;
    appendLog("info", `Uploading ${file.name}…`);
    if (file.size > 5 * 1024 * 1024) {
      appendLog(
        "info",
        "Large archive — wait for the upload to finish; steps appear once the server receives the file.",
      );
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (overwrite) {
        formData.append("overwrite", "1");
      }

      const response = await fetch("/api/templates/import?stream=1", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/x-ndjson" },
      });

      if (!response.ok && !response.body) {
        let message = "Import failed. Try again.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          /* ignore */
        }
        appendLog("error", message);
        setError(message);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        appendLog("error", "No response stream from server.");
        setError("No response stream from server.");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const onEvent = (event: ImportProgressEvent) => {
        if (event.type === "done" || event.type === "error") {
          finished = true;
        }
        handleProgressEvent(event);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            onEvent(JSON.parse(trimmed) as ImportProgressEvent);
          } catch {
            appendLog("error", "Invalid progress event from server.");
            finished = true;
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          onEvent(JSON.parse(tail) as ImportProgressEvent);
        } catch {
          /* ignore partial tail */
        }
      }

      if (!finished) {
        appendLog("error", "Installation ended without a result.");
        setError("Installation ended without a result.");
      }
    } catch {
      const message =
        "Could not reach the import API. Is the dashboard running locally?";
      appendLog("error", message);
      setError(message);
    } finally {
      setImporting(false);
      setActiveStep(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Select a .zip template archive first.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Only .zip files are accepted.");
      return;
    }

    setError(null);
    setSuccess(null);
    setOverwritePrompt(null);

    try {
      const previewForm = new FormData();
      previewForm.append("file", file);
      const previewResponse = await fetch("/api/templates/import?preview=1", {
        method: "POST",
        body: previewForm,
      });

      let previewPayload: {
        ok?: boolean;
        templateId?: string;
        exists?: boolean;
        error?: string;
      } = {};
      try {
        previewPayload = (await previewResponse.json()) as typeof previewPayload;
      } catch {
        setError("Could not read preview response from server.");
        return;
      }

      if (!previewResponse.ok || !previewPayload.ok || !previewPayload.templateId) {
        setError(previewPayload.error ?? "Could not inspect the zip archive.");
        return;
      }

      if (previewPayload.exists) {
        setOverwritePrompt({ templateId: previewPayload.templateId });
        return;
      }

      await runImport(false);
    } catch {
      setError("Could not reach the import API. Is the dashboard running locally?");
    }
  };

  const handleConfirmOverwrite = () => {
    void runImport(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          setSuccess(null);
          setLogs([]);
          setOverwritePrompt(null);
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        <Upload className="h-4 w-4 shrink-0" aria-hidden />
        Import template
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
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2
                  id={`${formId}-title`}
                  className="text-lg font-semibold text-zinc-900"
                >
                  Import game template
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Upload a .zip — progress and commands are shown live below.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={importing}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleImport();
              }}
            >
              <label className="flex shrink-0 flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  Template archive
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  disabled={importing}
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setFile(selected);
                    setError(null);
                    setSuccess(null);
                    setLogs([]);
                    setOverwritePrompt(null);
                  }}
                  className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60"
                />
              </label>

              {(importing || logs.length > 0) ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <Terminal className="h-3.5 w-3.5" aria-hidden />
                    Installation log
                    {importing && activeStep ? (
                      <span className="normal-case text-indigo-600">
                        — {activeStep}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="min-h-[140px] flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-950 px-3 py-2.5 font-mono text-xs leading-relaxed"
                    aria-live="polite"
                    aria-busy={importing}
                  >
                    {logs.map((line) => (
                      <div
                        key={line.id}
                        className={
                          line.kind === "command"
                            ? "text-indigo-300"
                            : line.kind === "error"
                              ? "text-red-400"
                              : line.kind === "success"
                                ? "text-emerald-400"
                                : "text-zinc-300"
                        }
                      >
                        {line.kind === "command" ? "$ " : "› "}
                        {line.text}
                        {line.detail ? (
                          <div className="pl-4 text-zinc-500">{line.detail}</div>
                        ) : null}
                      </div>
                    ))}
                    {importing ? (
                      <div className="mt-1 flex items-center gap-2 text-zinc-400">
                        <Loader2
                          className="h-3.5 w-3.5 shrink-0 animate-spin"
                          aria-hidden
                        />
                        Working…
                      </div>
                    ) : null}
                    <div ref={logEndRef} />
                  </div>
                </div>
              ) : null}

              {overwritePrompt ? (
                <div
                  className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
                  role="alertdialog"
                  aria-labelledby={`${formId}-overwrite-title`}
                >
                  <p
                    id={`${formId}-overwrite-title`}
                    className="text-sm font-medium text-amber-950"
                  >
                    Replace existing template?
                  </p>
                  <p className="mt-1 text-sm text-amber-900/90">
                    A template named{" "}
                    <span className="font-mono font-semibold">
                      {overwritePrompt.templateId}
                    </span>{" "}
                    is already installed. Overwriting will delete the current
                    version and install this zip instead.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmOverwrite}
                      disabled={importing}
                      className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-800 disabled:opacity-60"
                    >
                      Overwrite template
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverwritePrompt(null)}
                      disabled={importing}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100/80 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="shrink-0 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              {success ? (
                <p
                  className="flex shrink-0 items-start gap-2 text-sm text-emerald-700"
                  role="status"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {success}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={importing || !file || overwritePrompt !== null}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Upload className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {importing ? "Installing…" : "Upload & Install Template"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
