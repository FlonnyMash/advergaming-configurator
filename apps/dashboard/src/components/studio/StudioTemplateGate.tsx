"use client";

import { getStudioTemplateOptions, useStudioConfigStore } from "@advergaming/studio-engine";
import type { GameTemplateId } from "@advergaming/shared";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getAppEnv } from "@/lib/env";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";

export function StudioTemplateGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");

  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateOptions = useMemo(
    () => getStudioTemplateOptions(getAppEnv()),
    [],
  );

  useEffect(() => {
    if (!templateParam) {
      const active = useWorkspaceSessionStore.getState().activeStudioTemplateId;
      if (active) {
        router.replace(`/studio?template=${encodeURIComponent(active)}`);
      } else {
        router.replace("/studio/templates");
      }
      return;
    }

    const known = templateOptions.some((t) => t.id === templateParam);
    if (!known) {
      setError(`Unknown template "${templateParam}". Import it or pick from the list.`);
      setReady(false);
      return;
    }

    setError(null);
    useWorkspaceSessionStore.getState().setActiveStudioTemplate(templateParam);

    if (selectedTemplateId !== templateParam) {
      useStudioConfigStore
        .getState()
        .setSelectedTemplateId(templateParam as GameTemplateId);
    }

    setReady(true);
  }, [templateParam, selectedTemplateId, templateOptions, router]);

  if (!templateParam) {
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/studio/templates")}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50"
        >
          Back to templates
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading template…
      </div>
    );
  }

  return <>{children}</>;
}
