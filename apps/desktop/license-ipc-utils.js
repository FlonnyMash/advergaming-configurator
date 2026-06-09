const { ipcMain } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

// ---------------------------------------------------------------------------
// LicenseManager — Electron main-process DRM & entitlement gatekeeper.
//
// Security contract:
//   • Uses the authenticated user's JWT (access_token) via the Authorization
//     header so Supabase RLS policies are enforced server-side.
//   • The service-role key is NEVER used here.
//   • On any error — network failure, timeout, unexpected exception — the
//     default response is DENY (fail-safe architecture).
//   • All denied attempts are logged to the console for internal audit.
//   • Tokens and raw DB rows NEVER leave this module or reach the renderer.
// ---------------------------------------------------------------------------

/** IPC response shapes — only boolean flags and error codes reach the renderer. */
const DENY_NO_LICENSE = Object.freeze({ allowed: false, reason: "NO_LICENSE" });
const DENY_EXPIRED = Object.freeze({ allowed: false, reason: "EXPIRED" });
const DENY_QUOTA = Object.freeze({ allowed: false, reason: "QUOTA_EXCEEDED" });
const DENY_ERROR = Object.freeze({ allowed: false, reason: "NO_LICENSE" });
const ALLOW = Object.freeze({ allowed: true });

/** Maximum milliseconds to wait for any Supabase query before denying. */
const QUERY_TIMEOUT_MS = 8_000;

/**
 * Injected at registration time — provides the current session without
 * coupling this module to auth-ipc-utils internals.
 *
 * @type {(() => { access_token: string, user: object } | null) | null}
 */
let _getSession = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Races a promise against a hard deadline; rejects with a timeout error if
 * the deadline is hit first. Used so a slow/offline Supabase does not stall
 * the export pipeline indefinitely.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(
        () => reject(new Error(`Supabase query timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

/**
 * Builds an authenticated PostgREST client that injects the user's JWT as the
 * Authorization bearer token. Supabase RLS then enforces row-level access
 * control on the server — no client-side trust is needed.
 *
 * The anon key is still required for the `apikey` header (PostgREST gateway),
 * but data access is governed entirely by the user's JWT claims.
 *
 * @param {string} accessToken  User's Supabase JWT (access_token).
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function buildUserClient(accessToken) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[license] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: { transport: ws },
  });
}

// ---------------------------------------------------------------------------
// Core eligibility logic
// ---------------------------------------------------------------------------

/**
 * Checks whether the current authenticated user's organisation holds a valid,
 * in-quota license for the requested template.
 *
 * All error paths (no session, DB error, network timeout, invalid payload)
 * return a deny response — the export pipeline must never proceed on ambiguity.
 *
 * @param {string} templateId  The template UUID to check entitlement for.
 * @returns {Promise<{ allowed: true } | { allowed: false, reason: 'EXPIRED' | 'QUOTA_EXCEEDED' | 'NO_LICENSE' }>}
 */
async function checkEligibility(templateId) {
  if (!templateId || typeof templateId !== "string" || templateId.trim() === "") {
    console.warn("[license] checkEligibility called with invalid templateId:", templateId);
    return DENY_NO_LICENSE;
  }

  const session = _getSession?.();
  if (!session) {
    console.warn(
      "[license] AUDIT — UNAUTHORIZED export attempt: no active session.",
      "templateId:", templateId,
    );
    return DENY_NO_LICENSE;
  }

  const userId = session.user?.id;
  if (!userId) {
    console.warn(
      "[license] AUDIT — UNAUTHORIZED export attempt: session has no user id.",
      "templateId:", templateId,
    );
    return DENY_NO_LICENSE;
  }

  let supabase;
  try {
    supabase = buildUserClient(session.access_token);
  } catch (err) {
    console.error("[license] Failed to build authenticated Supabase client:", err.message);
    return DENY_ERROR;
  }

  try {
    // ------------------------------------------------------------------
    // 1. Resolve the user's organisation from their profile.
    // ------------------------------------------------------------------
    const { data: profile, error: profileError } = await withTimeout(
      supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .single(),
      QUERY_TIMEOUT_MS,
    );

    if (profileError || !profile?.organization_id) {
      console.warn(
        "[license] AUDIT — UNAUTHORIZED export attempt: profile missing or no org.",
        "userId:", userId,
        "templateId:", templateId,
        profileError?.message ?? "(no organisation_id)",
      );
      return DENY_NO_LICENSE;
    }

    const orgId = profile.organization_id;

    // ------------------------------------------------------------------
    // 2. Fetch the license row for this organisation + template.
    // ------------------------------------------------------------------
    const { data: license, error: licenseError } = await withTimeout(
      supabase
        .from("licenses")
        .select("id, max_projects, valid_until")
        .eq("organization_id", orgId)
        .eq("template_id", templateId)
        .maybeSingle(),
      QUERY_TIMEOUT_MS,
    );

    if (licenseError) {
      console.error(
        "[license] DB error fetching license — defaulting to deny.",
        "orgId:", orgId,
        "templateId:", templateId,
        licenseError.message,
      );
      return DENY_ERROR;
    }

    if (!license) {
      console.warn(
        "[license] AUDIT — UNAUTHORIZED export attempt: NO_LICENSE.",
        "orgId:", orgId,
        "templateId:", templateId,
      );
      return DENY_NO_LICENSE;
    }

    // ------------------------------------------------------------------
    // 3. Check licence expiry (valid_until == null → perpetual).
    // ------------------------------------------------------------------
    if (license.valid_until !== null) {
      const expiry = new Date(license.valid_until);
      if (Number.isNaN(expiry.getTime()) || expiry < new Date()) {
        console.warn(
          "[license] AUDIT — UNAUTHORIZED export attempt: EXPIRED.",
          "orgId:", orgId,
          "templateId:", templateId,
          "valid_until:", license.valid_until,
        );
        return DENY_EXPIRED;
      }
    }

    // ------------------------------------------------------------------
    // 4. Check project quota (max_projects == -1 → unlimited).
    // ------------------------------------------------------------------
    if (license.max_projects !== -1) {
      // Count distinct projects the org has already exported (via campaign
      // records). Each campaign entry represents at least one export of a
      // project, so distinct project_id count is the conservative measure
      // of "projects used".
      //
      // NOTE: This counts across all templates for the org. A per-template
      // projects_used counter on the licenses table would give finer-grained
      // quota enforcement and is recommended as a future schema addition.
      const { data: campaignRows, error: campaignError } = await withTimeout(
        supabase
          .from("campaigns")
          .select("project_id")
          .eq("organization_id", orgId),
        QUERY_TIMEOUT_MS,
      );

      if (campaignError) {
        console.error(
          "[license] DB error counting projects — defaulting to deny (finite quota).",
          "orgId:", orgId,
          campaignError.message,
        );
        return DENY_ERROR;
      }

      const projectsUsed = new Set(
        (campaignRows ?? []).map((row) => row.project_id),
      ).size;

      if (projectsUsed >= license.max_projects) {
        console.warn(
          "[license] AUDIT — UNAUTHORIZED export attempt: QUOTA_EXCEEDED.",
          "orgId:", orgId,
          "templateId:", templateId,
          `used=${projectsUsed}`,
          `max=${license.max_projects}`,
        );
        return DENY_QUOTA;
      }
    }

    // All checks passed.
    return ALLOW;

  } catch (err) {
    // Network failure, timeout, or any unexpected exception → fail-safe deny.
    console.error(
      "[license] AUDIT — UNAUTHORIZED export attempt: network/unexpected error.",
      "templateId:", templateId,
      err.message,
    );
    return DENY_ERROR;
  }
}

// ---------------------------------------------------------------------------
// IPC handler
// ---------------------------------------------------------------------------

/**
 * IPC handler for `license:check-eligibility`.
 * Payload: { templateId: string }
 * Response: { allowed: boolean, reason?: 'EXPIRED' | 'QUOTA_EXCEEDED' | 'NO_LICENSE' }
 *
 * Only boolean flags and reason codes reach the renderer — never raw DB data,
 * tokens, or internal error messages that could expose server internals.
 */
async function handleCheckEligibility(_event, payload) {
  const templateId = payload?.templateId;
  return checkEligibility(templateId);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Registers the `license:check-eligibility` IPC channel.
 *
 * Must be called after `registerAuthIpc()` so that getSession already reflects
 * any persisted session that was restored on startup.
 *
 * @param {() => { access_token: string, user: object } | null} getSession
 *   Factory that returns the current main-process session snapshot.
 *   Provided by auth-ipc-utils.getSessionForInternal — never pass raw tokens
 *   directly; always go through the accessor so the auth module retains sole
 *   ownership of the credential store.
 */
function registerLicenseIpc(getSession) {
  if (typeof getSession !== "function") {
    throw new Error("[license] registerLicenseIpc requires a getSession function.");
  }
  _getSession = getSession;
  ipcMain.handle("license:check-eligibility", handleCheckEligibility);
}

module.exports = { registerLicenseIpc };
