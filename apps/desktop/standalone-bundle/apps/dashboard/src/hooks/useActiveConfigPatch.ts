"use client";

import { useSaveGameProject } from "@/hooks/useSaveGameProject";
import { useConfiguratorStore } from "@advergaming/configurator-engine";
import { useStudioConfigStore } from "@advergaming/studio-engine";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export type ConfigPatchSurface = {
  patchBrandingPath: (path: string, value: unknown) => void;
  patchSystemPath: (path: string, value: unknown) => void;
  selectedTemplateId: string;
  saveTarget: "studio-template" | "project" | "none";
  saveLayout: () => Promise<boolean>;
};

export function useActiveConfigPatch(): ConfigPatchSurface {
  const pathname = usePathname();
  const projectMode = useConfiguratorStore((s) => s.projectMode);
  const projectId = useConfiguratorStore((s) => s.projectId);
  const { saveProject } = useSaveGameProject();

  const studioPatchBranding = useStudioConfigStore((s) => s.patchBrandingPath);
  const studioPatchSystem = useStudioConfigStore((s) => s.patchSystemPath);
  const studioTemplateId = useStudioConfigStore((s) => s.selectedTemplateId);

  const configPatchBranding = useConfiguratorStore((s) => s.patchBrandingPath);
  const configTemplateId = useConfiguratorStore((s) => s.selectedTemplateId);

  return useMemo(() => {
    const isConfigurator = pathname.startsWith("/configurator");

    if (isConfigurator && projectMode && projectId) {
      return {
        patchBrandingPath: configPatchBranding,
        patchSystemPath: () => {},
        selectedTemplateId: configTemplateId,
        saveTarget: "project" as const,
        saveLayout: saveProject,
      };
    }

    if (pathname.startsWith("/studio")) {
      return {
        patchBrandingPath: studioPatchBranding,
        patchSystemPath: studioPatchSystem,
        selectedTemplateId: studioTemplateId,
        saveTarget: "studio-template" as const,
        saveLayout: async () => {
          const response = await fetch(
            `/api/templates/save-config?templateId=${encodeURIComponent(studioTemplateId)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                config: useStudioConfigStore.getState().config,
              }),
            },
          );
          const payload = (await response.json()) as { ok?: boolean };
          return response.ok && Boolean(payload.ok);
        },
      };
    }

    return {
      patchBrandingPath: () => {},
      patchSystemPath: () => {},
      selectedTemplateId: "",
      saveTarget: "none" as const,
      saveLayout: async () => false,
    };
  }, [
    configPatchBranding,
    configTemplateId,
    pathname,
    projectId,
    projectMode,
    saveProject,
    studioPatchBranding,
    studioPatchSystem,
    studioTemplateId,
  ]);
}
