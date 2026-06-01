"use client";

import { useConfigStore } from "@/store/useConfigStore";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-zinc-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-indigo-500" : "bg-zinc-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function ConfigSidebar() {
  const config = useConfigStore((state) => state.config);
  const setTheme = useConfigStore((state) => state.setTheme);
  const setGameplay = useConfigStore((state) => state.setGameplay);
  const setDomOverlay = useConfigStore((state) => state.setDomOverlay);
  const resetConfig = useConfigStore((state) => state.resetConfig);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">
            Advergaming Configurator
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Tweak settings and preview live
          </p>
        </div>
        <button
          type="button"
          onClick={resetConfig}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          Reset
        </button>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <Section title="Theme">
          <Field label="Primary color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.theme.primaryColor}
                onChange={(e) => setTheme({ primaryColor: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1"
              />
              <span className="font-mono text-sm text-zinc-600">
                {config.theme.primaryColor}
              </span>
            </div>
          </Field>
        </Section>

        <Section title="Gameplay">
          <Field label={`Player speed — ${config.gameplay.playerSpeed}`}>
            <input
              type="range"
              min={50}
              max={400}
              step={10}
              value={config.gameplay.playerSpeed}
              onChange={(e) =>
                setGameplay({ playerSpeed: Number(e.target.value) })
              }
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>50</span>
              <span>400</span>
            </div>
          </Field>
        </Section>

        <Section title="DOM Overlay">
          <Field label="Start screen title">
            <input
              type="text"
              value={config.domOverlay.startScreenTitle}
              onChange={(e) =>
                setDomOverlay({ startScreenTitle: e.target.value })
              }
              className={inputClass}
            />
          </Field>

          <Field label="CTA button text">
            <input
              type="text"
              value={config.domOverlay.ctaButtonText}
              onChange={(e) =>
                setDomOverlay({ ctaButtonText: e.target.value })
              }
              className={inputClass}
            />
          </Field>

          <Toggle
            label="Show lead form"
            checked={config.domOverlay.showLeadForm}
            onChange={(checked) => setDomOverlay({ showLeadForm: checked })}
          />

          <Toggle
            label="Show highscores"
            checked={config.domOverlay.showHighscores}
            onChange={(checked) => setDomOverlay({ showHighscores: checked })}
          />
        </Section>
      </div>
    </aside>
  );
}
