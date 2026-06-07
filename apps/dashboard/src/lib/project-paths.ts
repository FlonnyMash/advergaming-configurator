import {
  ensureWorkspaceExists as ensureSharedWorkspaceExists,
  getProjectsRoot as getSharedProjectsRoot,
  PROJECTS_DIR_NAME,
} from "@mashedgames/shared";
import { PROJECT_ID_PATTERN } from "@mashedgames/shared";
import path from "node:path";
import { getWorkspacePath } from "@/lib/env";
import {
  getWorkspaceTemplatesRoot,
  templateLibraryRoot,
} from "@/lib/template-library-root";
import { isWorkspaceDesktop } from "@/lib/runtime-env";

export { templateLibraryRoot, getWorkspaceTemplatesRoot };

export { PROJECTS_DIR_NAME };

export function getProjectsRoot(): string {
  return getSharedProjectsRoot(getWorkspacePath());
}

export function ensureWorkspaceExists(): void {
  ensureSharedWorkspaceExists({
    workspacePath: getWorkspacePath(),
    ensureLibrary: isWorkspaceDesktop(),
  });
}

export function resolveProjectDir(projectId: string): string {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error("Invalid project ID.");
  }

  const projectsRoot = path.resolve(getProjectsRoot());
  const resolved = path.resolve(projectsRoot, projectId);

  if (
    !resolved.startsWith(projectsRoot + path.sep) &&
    resolved !== projectsRoot
  ) {
    throw new Error("Invalid project path.");
  }

  return resolved;
}

export const PROJECT_FILES = {
  manifest: "project.json",
  client: "client.json",
  parentLock: "parent-lock.json",
  assetsDir: "assets",
} as const;
