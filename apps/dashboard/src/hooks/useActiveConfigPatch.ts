"use client";

import { useSaveGameProject } from "@/hooks/useSaveGameProject";
import { useConfiguratorStore } from "@mashedgames/configurator-engine";
import { useStudioConfigStore } from "@mashedgames/studio-engine";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { GameConfig } from "@mashedgames/shared";

export type ConfigPatchSurface = {
  patchConfigKey: <K extends keyof GameConfig>(
    key: K,
    value: GameConfig[K],
  ) => void;
  selectedTemplateId: string;
  saveTarget: "studio-template" | "project" | "none";
  saveLayout: () => Promise<boolean>;
};

export function useActiveConfigPatch(): ConfigPatchSurface {
  const pathname = usePathname();
  const projectMode = useConfiguratorStore((state) => state.projectMode);
  const projectId = useConfiguratorStore((state) => state.projectId);
  const { saveProject } = useSaveGameProject();

  const studioPatchConfig = useStudioConfigStore((state) => state.patchConfig);
  const studioTemplateId = useStudioConfigStore((state) => state.selectedTemplateId);

  const configPatchConfig = useConfiguratorStore((state) => state.patchConfig);
  const configTemplateId = useConfiguratorStore((state) => state.selectedTemplateId);

  return useMemo(() => {
    const isConfigurator = pathname.startsWith("/configurator");

    if (isConfigurator && projectMode && projectId) {
      return {
        patchConfigKey: configPatchConfig,
        selectedTemplateId: configTemplateId,
        saveTarget: "project" as const,
        saveLayout: saveProject,
      };
    }

    if (pathname.startsWith("/studio")) {
      return {
        patchConfigKey: studioPatchConfig,
        selectedTemplateId: studioTemplateId,
        saveTarget: "none" as const,
        saveLayout: async () => false,
      };
    }

    return {
      patchConfigKey: () => {},
      selectedTemplateId: "",
      saveTarget: "none" as const,
      saveLayout: async () => false,
    };
  }, [
    configPatchConfig,
    configTemplateId,
    pathname,
    projectId,
    projectMode,
    saveProject,
    studioPatchConfig,
    studioTemplateId,
  ]);
}
