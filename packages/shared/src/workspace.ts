export const PROJECTS_DIR_NAME = "Projects" as const;
export const LIBRARY_DIR_NAME = "library" as const;

function joinPath(base: string, segment: string): string {
  const normalizedBase = base.replace(/[\\/]+$/, "");
  const normalizedSegment = segment.replace(/^[\\/]+/, "");
  return `${normalizedBase}/${normalizedSegment}`;
}

export function getWorkspacePathFromEnv(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.MASHEDGAMES_WORKSPACE_PATH?.trim()
      : undefined;
  if (fromEnv) {
    return fromEnv;
  }
  const cwd = typeof process !== "undefined" ? process.cwd() : ".";
  return joinPath(cwd, ".local-workspace");
}

export function getProjectsRoot(workspacePath = getWorkspacePathFromEnv()): string {
  return joinPath(workspacePath, PROJECTS_DIR_NAME);
}

export function getLibraryRoot(workspacePath = getWorkspacePathFromEnv()): string {
  return joinPath(workspacePath, LIBRARY_DIR_NAME);
}

export type EnsureWorkspaceOptions = {
  workspacePath?: string;
  ensureLibrary?: boolean;
};

/**
 * Ensures workspace directories exist before any local I/O.
 * Targets paths relative to Electron-injected MASHEDGAMES_WORKSPACE_PATH.
 */
export function ensureWorkspaceExists(options: EnsureWorkspaceOptions = {}): void {
  // Placeholder wrapper for workspace guard in the reset architecture.
  // Directory creation is handled by app-level I/O paths.
  void options;
}
