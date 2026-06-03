"use client";

import { create } from "zustand";

const STORAGE_KEY = "mashedgames-workspace-session";

type SessionSnapshot = {
  activeStudioTemplateId: string | null;
  activeConfiguratorProjectId: string | null;
};

function readStorage(): SessionSnapshot {
  if (typeof window === "undefined") {
    return { activeStudioTemplateId: null, activeConfiguratorProjectId: null };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { activeStudioTemplateId: null, activeConfiguratorProjectId: null };
    }
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>;
    return {
      activeStudioTemplateId:
        typeof parsed.activeStudioTemplateId === "string"
          ? parsed.activeStudioTemplateId
          : null,
      activeConfiguratorProjectId:
        typeof parsed.activeConfiguratorProjectId === "string"
          ? parsed.activeConfiguratorProjectId
          : null,
    };
  } catch {
    return { activeStudioTemplateId: null, activeConfiguratorProjectId: null };
  }
}

function writeStorage(snapshot: SessionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota */
  }
}

interface WorkspaceSessionStore extends SessionSnapshot {
  setActiveStudioTemplate: (templateId: string | null) => void;
  setActiveConfiguratorProject: (projectId: string | null) => void;
  clearStudioSession: () => void;
  clearConfiguratorSession: () => void;
}

const emptySession: SessionSnapshot = {
  activeStudioTemplateId: null,
  activeConfiguratorProjectId: null,
};

let hasRehydratedFromStorage = false;

/** Restore session from sessionStorage after mount so SSR and the first client render match. */
export function rehydrateWorkspaceSessionFromStorage(): void {
  if (typeof window === "undefined" || hasRehydratedFromStorage) return;
  hasRehydratedFromStorage = true;
  useWorkspaceSessionStore.setState(readStorage());
}

export const useWorkspaceSessionStore = create<WorkspaceSessionStore>((set, get) => ({
  activeStudioTemplateId: emptySession.activeStudioTemplateId,
  activeConfiguratorProjectId: emptySession.activeConfiguratorProjectId,

  setActiveStudioTemplate: (templateId) => {
    const next = { ...get(), activeStudioTemplateId: templateId };
    set({ activeStudioTemplateId: templateId });
    writeStorage({
      activeStudioTemplateId: templateId,
      activeConfiguratorProjectId: next.activeConfiguratorProjectId,
    });
  },

  setActiveConfiguratorProject: (projectId) => {
    const next = { ...get(), activeConfiguratorProjectId: projectId };
    set({ activeConfiguratorProjectId: projectId });
    writeStorage({
      activeStudioTemplateId: next.activeStudioTemplateId,
      activeConfiguratorProjectId: projectId,
    });
  },

  clearStudioSession: () => {
    get().setActiveStudioTemplate(null);
  },

  clearConfiguratorSession: () => {
    get().setActiveConfiguratorProject(null);
  },
}));

export function studioWorkspaceHref(templateId: string | null): string {
  return templateId
    ? `/studio?template=${encodeURIComponent(templateId)}`
    : "/studio/templates";
}

export function configuratorWorkspaceHref(projectId: string | null): string {
  return projectId
    ? `/configurator?project=${encodeURIComponent(projectId)}`
    : "/configurator/projects";
}
