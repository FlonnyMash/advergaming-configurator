import { PROJECT_ID_PATTERN } from "@mashedgames/shared";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getWorkspacePath } from "@/lib/env";
import {
  getWorkspaceTemplatesRoot,
  templateLibraryRoot,
} from "@/lib/template-library-root";
import { isWorkspaceDesktop } from "@/lib/runtime-env";

export { templateLibraryRoot, getWorkspaceTemplatesRoot };

export const PROJECTS_DIR_NAME = "Projects" as const;

export function getProjectsRoot(): string {
  return path.join(getWorkspacePath(), PROJECTS_DIR_NAME);
}

export function ensureWorkspaceExists(): void {
  const workspacePath = getWorkspacePath();
  const projectsPath = getProjectsRoot();
  const templatesPath = getWorkspaceTemplatesRoot();

  try {
    mkdirSync(projectsPath, { recursive: true });
    if (isWorkspaceDesktop()) {
      mkdirSync(templatesPath, { recursive: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to initialize workspace "${workspacePath}" (projects: "${projectsPath}", templates: "${templatesPath}"): ${message}`,
    );
  }
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
