"use client";

import { useConfiguratorStore } from "@mashedgames/configurator-engine";
import { useCallback, useState } from "react";

export function useSaveGameProject() {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveProject = useCallback(async () => {
    const projectId = useConfiguratorStore.getState().projectId;
    if (!projectId) {
      setError("No project loaded.");
      return false;
    }

    const client = useConfiguratorStore.getState().exportClientPayload();
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Save failed.");
      }
      useConfiguratorStore.getState().markClientSaved();
      setStatus("Project saved.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saveProject, saving, status, error };
}

export async function saveProjectClientNow(projectId: string): Promise<void> {
  const client = useConfiguratorStore.getState().exportClientPayload();
  const response = await fetch(`/api/projects/${projectId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client }),
  });
  const data = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Save failed.");
  }
  useConfiguratorStore.getState().markClientSaved();
}
