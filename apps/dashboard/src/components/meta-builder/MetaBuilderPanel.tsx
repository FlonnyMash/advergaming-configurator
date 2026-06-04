"use client";

import { consumeSseStream } from "@/components/meta-builder/meta-builder-sse";
import { usePlatformStore } from "@/store/usePlatformStore";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRef, useState } from "react";

type BuildOutcome = "idle" | "building" | "success" | "failed";

function pickPlatformSnapshot() {
  const state = usePlatformStore.getState();
  return {
    appName: state.appName,
    primaryColor: state.primaryColor,
    logoPath: state.logoPath,
    features: { ...state.features },
  };
}

export function MetaBuilderPanel() {
  const appName = usePlatformStore((s) => s.appName);
  const primaryColor = usePlatformStore((s) => s.primaryColor);
  const logoPath = usePlatformStore((s) => s.logoPath);
  const features = usePlatformStore((s) => s.features);
  const updatePlatformConfig = usePlatformStore((s) => s.updatePlatformConfig);
  const resetPlatformConfig = usePlatformStore((s) => s.resetPlatformConfig);

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildOutcome, setBuildOutcome] = useState<BuildOutcome>("idle");
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildLog, setBuildLog] = useState("");
  const buildLogRef = useRef<HTMLPreElement>(null);

  const appendBuildLog = (chunk: string) => {
    setBuildLog((prev) => prev + chunk);
    requestAnimationFrame(() => {
      const el = buildLogRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveStatus(null);

    try {
      const response = await fetch("/api/dev-tools/save-platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pickPlatformSnapshot()),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setSaveError(data.error ?? "Failed to save platform config.");
        return;
      }

      setSaveStatus("Saved platform-config.json to disk.");
    } catch {
      setSaveError("Failed to save platform config.");
    } finally {
      setSaving(false);
    }
  };

  const failBuild = (message: string) => {
    setBuildOutcome("failed");
    setBuildError(message);
    setBuildStatus(null);
  };

  const handleBuild = async () => {
    setBuilding(true);
    setBuildOutcome("building");
    setBuildError(null);
    setBuildStatus("Starting production build…");
    setBuildLog("");

    let buildSucceeded = false;
    let streamError: string | null = null;

    try {
      const response = await fetch("/api/dev-tools/build-engine", {
        method: "POST",
      });

      if (!response.ok) {
        failBuild(`Build request failed (${response.status}).`);
        return;
      }

      await consumeSseStream(response, (event, data) => {
        if (event === "status") {
          setBuildStatus(data);
          appendBuildLog(`[status] ${data}\n`);
          return;
        }

        if (event === "stdout" || event === "stderr") {
          appendBuildLog(data);
          return;
        }

        if (event === "error") {
          streamError = data;
          setBuildError(data);
          appendBuildLog(`[error] ${data}\n`);
          return;
        }

        if (event === "done") {
          try {
            const payload = JSON.parse(data) as { ok?: boolean };
            buildSucceeded = payload.ok === true;
          } catch {
            buildSucceeded = false;
          }
        }
      });

      if (buildSucceeded) {
        setBuildOutcome("success");
        setBuildError(null);
        setBuildStatus("Production build finished successfully.");
      } else {
        failBuild(streamError ?? "Build failed. See log for details.");
      }
    } catch {
      failBuild("Build request failed.");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Branding</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">App name</span>
            <input
              type="text"
              value={appName}
              onChange={(e) => updatePlatformConfig({ appName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Primary color</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) =>
                  updatePlatformConfig({ primaryColor: e.target.value })
                }
                className="h-9 w-12 cursor-pointer rounded border border-zinc-200"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) =>
                  updatePlatformConfig({ primaryColor: e.target.value })
                }
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Logo path</span>
            <input
              type="text"
              value={logoPath}
              onChange={(e) => updatePlatformConfig({ logoPath: e.target.value })}
              placeholder="/mashed-games-logo.png"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Path under the dashboard <code className="text-zinc-500">public/</code>{" "}
              folder.
            </p>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Feature flags</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-700">Enable lead generation</span>
            <input
              type="checkbox"
              checked={features.enableLeadGen}
              onChange={(e) =>
                updatePlatformConfig({
                  features: { enableLeadGen: e.target.checked },
                })
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-700">Enable custom CSS</span>
            <input
              type="checkbox"
              checked={features.enableCustomCSS}
              onChange={(e) =>
                updatePlatformConfig({
                  features: { enableCustomCSS: e.target.checked },
                })
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Max templates</span>
            <input
              type="number"
              min={0}
              value={features.maxTemplates}
              onChange={(e) =>
                updatePlatformConfig({
                  features: {
                    maxTemplates: Math.max(0, Number(e.target.value) || 0),
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || building}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save Platform Config
          </button>
          <button
            type="button"
            onClick={() => void handleBuild()}
            disabled={saving || building}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {building ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Compile Production Build
          </button>
          <button
            type="button"
            onClick={resetPlatformConfig}
            disabled={saving || building}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            Reset session
          </button>
        </div>
        {saveStatus ? (
          <p className="mt-3 text-xs text-green-700">{saveStatus}</p>
        ) : null}
        {saveError ? (
          <p className="mt-3 text-xs text-red-600">{saveError}</p>
        ) : null}
        {buildOutcome !== "idle" ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 flex items-start gap-3 rounded-lg border px-3 py-3 ${
              buildOutcome === "building"
                ? "border-indigo-200 bg-indigo-50"
                : buildOutcome === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            {buildOutcome === "building" ? (
              <Loader2
                className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-indigo-600"
                aria-hidden
              />
            ) : null}
            {buildOutcome === "success" ? (
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
                aria-hidden
              />
            ) : null}
            {buildOutcome === "failed" ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            ) : null}
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold ${
                  buildOutcome === "building"
                    ? "text-indigo-900"
                    : buildOutcome === "success"
                      ? "text-green-600"
                      : "text-red-600"
                }`}
              >
                {buildOutcome === "building"
                  ? "Building…"
                  : buildOutcome === "success"
                    ? "Success"
                    : "Failed"}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  buildOutcome === "building"
                    ? "text-indigo-700"
                    : buildOutcome === "success"
                      ? "text-green-700"
                      : "text-red-700"
                }`}
              >
                {buildOutcome === "failed"
                  ? (buildError ?? "Build failed.")
                  : (buildStatus ?? "Working…")}
              </p>
            </div>
          </div>
        ) : null}
        {buildLog || building ? (
          <pre
            ref={buildLogRef}
            className="mt-4 max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100"
          >
            {buildLog || (building ? "Waiting for build output…" : "")}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
