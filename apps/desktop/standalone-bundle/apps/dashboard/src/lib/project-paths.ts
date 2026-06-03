import { PROJECT_ID_PATTERN } from "@mashedgames/shared";
import path from "node:path";

const dashboardRoot = path.resolve(process.cwd());

export const templateLibraryRoot = path.resolve(
  dashboardRoot,
  process.env.TEMPLATE_LIBRARY_ROOT ??
    "../game-engine/src/templates/library",
);

export function getWorkspaceRoot(): string {
  if (process.env.WORKSPACE_DIR) {
    return path.resolve(process.env.WORKSPACE_DIR);
  }
  return path.join(process.cwd(), "games");
}

export function resolveProjectDir(projectId: string): string {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error("Invalid project ID.");
  }
  const workspaceRoot = getWorkspaceRoot();
  const resolved = path.resolve(workspaceRoot, projectId);
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
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
