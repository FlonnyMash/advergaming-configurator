"use client";

import { exportClientPayload } from "@mashedgames/shared";
import { useState } from "react";
import { useConfiguratorStore } from "../store/useConfiguratorStore";

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

export function ConfiguratorDiagnostics() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const config = useConfiguratorStore((s) => s.config);
  const clientPayload = exportClientPayload(config);

  return (
    <Section title="Diagnostics">
      <button
        type="button"
        onClick={() => setShowDiagnostics((v) => !v)}
        className="w-full rounded-lg border border-zinc-200 py-2 text-sm hover:bg-zinc-50"
      >
        {showDiagnostics ? "Hide" : "View"} raw client payload
      </button>
      {showDiagnostics ? (
        <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          {JSON.stringify(clientPayload, null, 2)}
        </pre>
      ) : null}
    </Section>
  );
}
