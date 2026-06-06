"use client";

import { useStudioConfigStore } from "@mashedgames/studio-engine";
import { useCallback, useState } from "react";

export function useSaveGameControls() {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveGameControls = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const { config, selectedTemplateId, markGameControlsSaved } =
      useStudioConfigStore.getState();

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/templates/save-config?templateId=${encodeURIComponent(selectedTemplateId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        },
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        const message = payload.error ?? "Could not save game controls to template.";
        setError(message);
        return { ok: false, error: message };
      }

      markGameControlsSaved();
      setStatus(
        `Saved game controls to templates/${selectedTemplateId} (config.json & manifest defaults).`,
      );
      return { ok: true };
    } catch {
      const message =
        "Could not reach the save API. Run the dashboard locally to write template files.";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setSaving(false);
    }
  }, []);

  return { saveGameControls, saving, status, error };
}

export async function saveTemplateConfigNow(): Promise<{ ok: boolean; error?: string }> {
  const { config, selectedTemplateId } = useStudioConfigStore.getState();

  try {
    const response = await fetch(
      `/api/templates/save-config?templateId=${encodeURIComponent(selectedTemplateId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      },
    );

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error ?? "Could not save template config." };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Could not reach the save API. Run the dashboard locally to write template files.",
    };
  }
}
