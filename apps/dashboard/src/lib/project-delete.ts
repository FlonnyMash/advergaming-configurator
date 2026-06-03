import { PROJECT_ID_PATTERN } from "@mashedgames/shared";
import { existsSync, rmSync } from "node:fs";
import { getProjectLocation } from "@/lib/project-location";
import { resolveProjectDir } from "@/lib/project-paths";

export type DeleteProjectResult =
  | { ok: true; projectId: string; repositoryPath: string }
  | { ok: false; error: string; status: number };

export function deleteProject(projectId: string): DeleteProjectResult {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    return { ok: false, error: "Invalid project ID.", status: 400 };
  }

  const location = getProjectLocation(projectId);
  if (!location.ok) {
    return { ok: false, error: location.error, status: location.status };
  }

  try {
    rmSync(resolveProjectDir(projectId), { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Could not remove project files: ${message}`,
      status: 500,
    };
  }

  if (existsSync(resolveProjectDir(projectId))) {
    return { ok: false, error: "Project folder could not be removed.", status: 500 };
  }

  return {
    ok: true,
    projectId,
    repositoryPath: location.data.repositoryPath,
  };
}
