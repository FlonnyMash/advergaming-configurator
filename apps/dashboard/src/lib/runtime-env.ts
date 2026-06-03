export function isWorkspaceDesktop(): boolean {
  return Boolean(process.env.MASHEDGAMES_WORKSPACE_PATH?.trim());
}

export function isWorkspaceDesktopClient(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_DESKTOP === "1";
}
