/** Auth IPC response shape returned by all three channels. */
export type AuthStatus = {
  isAuthenticated: boolean;
  email: string | null;
  userId: string | null;
  error?: string;
};

/**
 * Returns the Electron ipcRenderer bridge, or null when running in a browser
 * dev context where window.electron is not present.
 *
 * Auth IPC is intentionally non-throwing in the web context — the dashboard
 * renders with isAuthenticated: false so layout/UI can be developed offline
 * without a running Electron shell.
 */
function getElectron() {
  return window.electron?.ipcRenderer ?? null;
}

/**
 * Authenticates the user via Supabase in the Electron main process.
 * The main process encrypts the resulting session tokens with safeStorage
 * and holds them in memory. Access/refresh tokens are never returned here.
 *
 * Returns null when called outside the Electron runtime (web dev context).
 */
export async function loginViaIpc(
  email: string,
  password: string,
): Promise<AuthStatus | null> {
  const electron = getElectron();
  if (!electron) return null;
  return electron.invoke("auth:login", { email, password });
}

/**
 * Signs out the current user in the Electron main process, clears the
 * in-memory session, and deletes the encrypted token file from disk.
 *
 * Returns null when called outside the Electron runtime.
 */
export async function logoutViaIpc(): Promise<AuthStatus | null> {
  const electron = getElectron();
  if (!electron) return null;
  return electron.invoke("auth:logout");
}

/**
 * Queries the current authentication state from the Electron main process.
 * Safe to call on every app boot — the main process has already restored any
 * persisted session before the renderer window is created.
 *
 * Returns null when called outside the Electron runtime.
 */
export async function getAuthStatusViaIpc(): Promise<AuthStatus | null> {
  const electron = getElectron();
  if (!electron) return null;
  return electron.invoke("auth:get-status");
}
