"use client";

import { ParentDriftDialog } from "@/components/configurator/ParentDriftDialog";
import { useConfiguratorStore } from "@advergaming/configurator-engine";
import type {
  ClientProjectPayload,
  GameMasterConfig,
  GameProjectManifest,
  ParentDriftReport,
} from "@advergaming/shared";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceSessionStore } from "@/lib/workspace-session-store";
import { useEffect, useState, type ReactNode } from "react";

export function ConfiguratorProjectGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");

  const projectId = useConfiguratorStore((s) => s.projectId);
  const [loading, setLoading] = useState(Boolean(projectParam));
  const [error, setError] = useState<string | null>(null);
  const [driftReport, setDriftReport] = useState<ParentDriftReport | null>(null);
  const [driftOpen, setDriftOpen] = useState(false);
  const [, setPreviewBlocked] = useState(false);

  useEffect(() => {
    if (!projectParam) {
      const active =
        useWorkspaceSessionStore.getState().activeConfiguratorProjectId;
      if (active) {
        router.replace(`/configurator?project=${encodeURIComponent(active)}`);
      } else {
        router.replace("/configurator/projects");
      }
      return;
    }

    useWorkspaceSessionStore.getState().setActiveConfiguratorProject(projectParam);

    if (projectId === projectParam) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${projectParam}`);
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
          manifest?: GameProjectManifest;
          config?: GameMasterConfig;
          client?: ClientProjectPayload;
        };

        if (!response.ok || !data.ok || !data.manifest || !data.config || !data.client) {
          throw new Error(data.error ?? "Failed to load project.");
        }

        if (cancelled) {
          return;
        }

        useConfiguratorStore.getState().hydrateProject({
          manifest: data.manifest,
          config: data.config,
          client: data.client,
        });

        const driftResponse = await fetch(
          `/api/projects/${projectParam}/parent-drift`,
        );
        const driftData = (await driftResponse.json()) as {
          ok?: boolean;
          report?: ParentDriftReport;
        };

        if (!cancelled && driftData.ok && driftData.report) {
          setDriftReport(driftData.report);
          if (driftData.report.items.length > 0) {
            setDriftOpen(true);
            setPreviewBlocked(driftData.report.hasBlockingItems);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectParam, projectId, router]);

  if (!projectParam) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading project…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/configurator/projects")}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50"
        >
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <>
      {children}
      <ParentDriftDialog
        open={driftOpen}
        report={driftReport}
        onDismiss={() => {
          setDriftOpen(false);
          setPreviewBlocked(false);
        }}
        onAcknowledged={() => {
          setDriftOpen(false);
          setPreviewBlocked(false);
          setDriftReport(null);
        }}
      />
    </>
  );
}
