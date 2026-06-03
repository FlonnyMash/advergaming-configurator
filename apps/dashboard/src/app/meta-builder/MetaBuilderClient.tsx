"use client";

import { usePlatformStore } from "@/store/usePlatformStore";
import { Loader2 } from "lucide-react";
import { useState } from "react";

function pickPlatformSnapshot() {
  const state = usePlatformStore.getState();
  return {
    appName: state.appName,
    primaryColor: state.primaryColor,
    logoPath: state.logoPath,
    features: { ...state.features },
  };
}

export function MetaBuilderClient() {
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
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

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

  const handleBuild = async () => {
    setBuilding(true);
    setBuildError(null);
    setBuildStatus("Running pnpm run build:desktop (this may take several minutes)…");

    try {
      const response = await fetch("/api/dev-tools/build-engine", {
        method: "POST",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        stdout?: string;
        stderr?: string;
      };

      if (!response.ok || !data.ok) {
        setBuildError(data.error ?? "Build failed.");
        setBuildStatus(null);
        return;
      }

      setBuildStatus("Build completed successfully.");
      if (data.stderr?.trim()) {
        setBuildError(data.stderr.trim());
      }
    } catch {
      setBuildError("Build request failed.");
      setBuildStatus(null);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-5 py-4">
        <h1 className="text-base font-semibold text-zinc-900">Meta-Builder</h1>
        <p className="mt-1 text-xs text-zinc-500">
          White-label platform branding and license feature flags. Dev-only; stripped
          from production builds.
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-lg space-y-6">
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
                Save to disk
              </button>
              <button
                type="button"
                onClick={() => void handleBuild()}
                disabled={saving || building}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                {building ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Rebuild platform
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
              <p className="mt-3 text-xs text-emerald-700">{saveStatus}</p>
            ) : null}
            {saveError ? (
              <p className="mt-3 text-xs text-red-600">{saveError}</p>
            ) : null}
            {buildStatus ? (
              <p className="mt-3 text-xs text-zinc-600">{buildStatus}</p>
            ) : null}
            {buildError ? (
              <p className="mt-3 whitespace-pre-wrap text-xs text-red-600">{buildError}</p>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
