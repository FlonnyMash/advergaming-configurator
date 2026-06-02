"use client";

import { getStudioTemplateOptions, useStudioConfigStore } from "@advergaming/studio-engine";
import type { GameTemplateId } from "@advergaming/shared";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getAppEnv } from "@/lib/env";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";

export function StudioTemplateGate({
  children,
  detached = false,
}: {
  children: ReactNode;
  /** Keep template alive in the background when another route is active. */
  detached?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");
  const activeSessionTemplateId = useWorkspaceSessionStore(
    (s) => s.activeStudioTemplateId,
  );
  const effectiveTemplateId =
    templateParam ?? (detached ? activeSessionTemplateId : null);

  const selectedTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateOptions = useMemo(
    () => getStudioTemplateOptions(getAppEnv()),
    [],
  );

  useEffect(() => {
    if (!effectiveTemplateId) {
      if (!detached) {
        router.replace("/studio/templates");
      }
      return;
    }

    if (!detached && !templateParam && activeSessionTemplateId) {
      router.replace(
        `/studio?template=${encodeURIComponent(activeSessionTemplateId)}`,
      );
      return;
    }

    const known = templateOptions.some((t) => t.id === effectiveTemplateId);
    if (!known) {
      setError(
        `Unknown template "${effectiveTemplateId}". Import it or pick from the list.`,
      );
      setReady(false);
      return;
    }

    setError(null);
    useWorkspaceSessionStore
      .getState()
      .setActiveStudioTemplate(effectiveTemplateId);

    if (selectedTemplateId !== effectiveTemplateId) {
      useStudioConfigStore
        .getState()
        .setSelectedTemplateId(effectiveTemplateId as GameTemplateId);
    }

    setReady(true);
  }, [
    activeSessionTemplateId,
    detached,
    effectiveTemplateId,
    selectedTemplateId,
    templateOptions,
    templateParam,
    router,
  ]);

  if (!effectiveTemplateId) {
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
