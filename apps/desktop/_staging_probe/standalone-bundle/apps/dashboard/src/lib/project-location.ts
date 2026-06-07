import { PROJECT_ID_PATTERN } from "@mashedgames/shared";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveProjectDir } from "@/lib/project-paths";

const dashboardRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(dashboardRoot, "../..");

export type ProjectLocation = {
  projectId: string;
  directoryPath: string;
  repositoryPath: string;
};

export function getProjectLocation(
  projectId: string,
):
  | { ok: true; data: ProjectLocation }
  | { ok: false; error: string; status: number } {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    return { ok: false, error: "Invalid project ID.", status: 400 };
  }

  let directoryPath: string;
  try {
    directoryPath = resolveProjectDir(projectId);
  } catch {
    return { ok: false, error: "Invalid project ID.", status: 400 };
  }

  if (!existsSync(directoryPath)) {
    return { ok: false, error: "Project not found.", status: 404 };
  }

  return {
    ok: true,
    data: {
      projectId,
      directoryPath,
      repositoryPath: path
        .relative(repoRoot, directoryPath)
        .split(path.sep)
        .join("/"),
    },
  };
}
