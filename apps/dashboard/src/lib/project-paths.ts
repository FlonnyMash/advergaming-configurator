import { PROJECT_ID_PATTERN } from "@advergaming/shared";
import path from "node:path";

const dashboardRoot = path.resolve(process.cwd());

export const templateLibraryRoot = path.resolve(
  dashboardRoot,
  process.env.TEMPLATE_LIBRARY_ROOT ??
    "../game-engine/src/templates/library",
);

export const projectsRoot = path.resolve(
  dashboardRoot,
  process.env.PROJECTS_ROOT ?? "../../games",
);

export function resolveProjectDir(projectId: string): string {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error("Invalid project ID.");
  }
  const resolved = path.resolve(projectsRoot, projectId);
  if (!resolved.startsWith(projectsRoot + path.sep) && resolved !== projectsRoot) {
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
