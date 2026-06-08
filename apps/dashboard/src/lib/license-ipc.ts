/**
 * Renderer-side bridge for the DRM entitlement check.
 *
 * Security contract:
 *   - The renderer sends ONLY the templateId.
 *   - The Electron main process is the sole authority on whether export is
 *     permitted. All token handling, DB queries, and business logic live there.
 *   - This module never receives tokens, raw DB rows, or internal error
 *     messages — only boolean flags and opaque reason codes.
 *   - Outside the Electron runtime (web dev context) all functions return null.
 *     Callers must treat null as "access denied" to stay fail-safe.
 */

/** Allowed deny reasons surfaced to the renderer. */
export type DenyReason = "EXPIRED" | "QUOTA_EXCEEDED" | "NO_LICENSE";

export type EligibilityResult =
  | { allowed: true }
  | { allowed: false; reason: DenyReason };

function getElectron() {
  return (window as Window & { electron?: { ipcRenderer: { invoke: (channel: string, payload?: unknown) => Promise<unknown> } } })
    .electron?.ipcRenderer ?? null;
}

/**
 * Asks the Electron main process whether the current user may export a project
 * that uses the given template.
 *
 * This is the **final gatekeeper** in the export pipeline. Call it immediately
 * before triggering any export action. Do not cache the result across
 * navigation or user changes.
 *
 * Returns `null` when called outside the Electron runtime. Treat `null` as
 * blocked — never assume access is granted on a missing response.
 *
 * @param templateId  The UUID of the template being exported.
 */
export async function checkExportEligibilityViaIpc(
  templateId: string,
): Promise<EligibilityResult | null> {
  const electron = getElectron();
  if (!electron) return null;
  return electron.invoke("license:check-eligibility", { templateId }) as Promise<EligibilityResult>;
}
