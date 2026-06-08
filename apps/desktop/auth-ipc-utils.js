const fs = require("node:fs");
const path = require("node:path");
const { app, ipcMain, safeStorage } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const TOKEN_FILE = "mashed-auth.bin";

// ---------------------------------------------------------------------------
// In-memory session state.
// access_token and refresh_token NEVER leave this module.
// The renderer only ever receives { isAuthenticated: boolean, email: string|null }.
// ---------------------------------------------------------------------------

/** @type {{ access_token: string, refresh_token: string, expires_at: number, email: string|null, user: object } | null} */
let _session = null;

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _supabase = null;

// ---------------------------------------------------------------------------
// Supabase client (lazy-initialised; fails gracefully if env vars are absent)
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[auth] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  _supabase = createClient(url, key, {
    auth: {
      // We manage persistence ourselves via safeStorage, so supabase-js must not
      // attempt to read/write localStorage or any other storage mechanism.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "mashed-auth-noop",
    },
    // Electron main process runs Node.js < 22 which has no native WebSocket.
    // Provide the ws package so the realtime transport initialises cleanly.
    // Auth-only usage means no realtime channels are ever opened.
    realtime: {
      transport: ws,
    },
  });

  return _supabase;
}

// ---------------------------------------------------------------------------
// safeStorage helpers — OS-level encryption (DPAPI / Keychain / libsecret)
// ---------------------------------------------------------------------------

function getTokenPath() {
  return path.join(app.getPath("userData"), TOKEN_FILE);
}

/**
 * Encrypts and writes a session snapshot to disk.
 * Only the access_token, refresh_token, expires_at, and email are persisted —
 * never the full user object or any internal Supabase state.
 *
 * If safeStorage encryption is unavailable (e.g. headless Linux without a
 * keyring daemon), the session is held in memory only and this function is a
 * no-op.
 */
function persistSession(session) {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn(
      "[auth] safeStorage unavailable — session will not be persisted to disk.",
    );
    return;
  }

  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    email: session.email ?? null,
  });

  try {
    // encryptString() returns a Buffer of OS-encrypted bytes.
    // These bytes can only be decrypted by the same OS user on the same machine.
    const encrypted = safeStorage.encryptString(payload);
    fs.writeFileSync(getTokenPath(), encrypted);
  } catch (error) {
    console.error("[auth] Failed to persist session:", error);
  }
}

/**
 * Reads and decrypts the persisted session file.
 * Returns null if no file exists, safeStorage is unavailable, or decryption fails.
 * Corrupted / undecryptable files are deleted automatically.
 */
function readPersistedSession() {
  const tokenPath = getTokenPath();

  if (!fs.existsSync(tokenPath)) return null;

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn(
      "[auth] safeStorage unavailable — cannot read persisted session.",
    );
    return null;
  }

  try {
    const encrypted = fs.readFileSync(tokenPath);
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error(
      "[auth] Failed to read or decrypt token file — clearing corrupted file:",
      error,
    );
    clearPersistedSession();
    return null;
  }
}

/** Removes the persisted session file. */
function clearPersistedSession() {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
  } catch (error) {
    console.error("[auth] Failed to delete token file:", error);
  }
}

// ---------------------------------------------------------------------------
// Status payload — the only shape ever sent to the renderer
// ---------------------------------------------------------------------------

function buildStatusPayload(session) {
  return {
    isAuthenticated: session !== null,
    email: session?.email ?? null,
    userId: session?.user?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Session restore (called once at startup, before the main window opens)
// ---------------------------------------------------------------------------

/**
 * Attempts to restore a persisted session from disk.
 *
 * Flow:
 *  1. Read + decrypt mashed-auth.bin from userData.
 *  2. Call supabase.auth.setSession({ access_token, refresh_token }).
 *     - If the access token is still valid, Supabase sets it in memory (no network call).
 *     - If it is expired, Supabase calls the refresh endpoint and returns new tokens.
 *  3. Persist the (potentially refreshed) tokens back to disk.
 *  4. On any failure: clear the file and continue unauthenticated.
 *
 * A 6-second safety timeout is applied to the Supabase refresh network call so that
 * a slow/offline network does not block the splash screen indefinitely.
 */
async function restoreSession() {
  const persisted = readPersistedSession();
  if (!persisted) return;

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    // Supabase not configured yet (env vars absent). This is expected in
    // local development before Supabase is provisioned.
    console.info("[auth] Supabase not configured:", error.message);
    return;
  }

  let data, error;
  try {
    const RESTORE_TIMEOUT_MS = 6000;
    const restorePromise = supabase.auth.setSession({
      access_token: persisted.access_token,
      refresh_token: persisted.refresh_token,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Session restore timed out after 6s")),
        RESTORE_TIMEOUT_MS,
      ),
    );
    ({ data, error } = await Promise.race([restorePromise, timeoutPromise]));
  } catch (err) {
    console.warn("[auth] Session restore failed or timed out:", err.message);
    // On timeout or network error, fall back to offline mode.
    // Keep persisted tokens on disk — they may be valid again once online.
    _session = {
      access_token: persisted.access_token,
      refresh_token: persisted.refresh_token,
      expires_at: persisted.expires_at,
      email: persisted.email ?? null,
      user: null,
    };
    return;
  }

  if (error || !data?.session) {
    console.warn(
      "[auth] Persisted session rejected by Supabase — clearing:",
      error?.message ?? "no session returned",
    );
    clearPersistedSession();
    _session = null;
    return;
  }

  _session = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    email: data.session.user?.email ?? null,
    user: data.session.user,
  };

  // Persist refreshed tokens so the next startup uses the latest refresh token.
  persistSession(_session);
  console.info("[auth] Session restored for:", _session.email);
}

// ---------------------------------------------------------------------------
// IPC channel handlers
// ---------------------------------------------------------------------------

async function handleLogin(_event, payload) {
  if (
    !payload ||
    typeof payload.email !== "string" ||
    typeof payload.password !== "string"
  ) {
    return {
      isAuthenticated: false,
      email: null,
      userId: null,
      error: "Invalid login payload.",
    };
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    return { isAuthenticated: false, email: null, userId: null, error: error.message };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error || !data?.session) {
    return {
      isAuthenticated: false,
      email: null,
      userId: null,
      error: error?.message ?? "Login failed.",
    };
  }

  _session = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    email: data.session.user?.email ?? null,
    user: data.session.user,
  };

  persistSession(_session);
  return buildStatusPayload(_session);
}

async function handleLogout(_event) {
  try {
    if (_session) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }
  } catch {
    // Best-effort remote sign-out. Always clear local state.
  }

  _session = null;
  clearPersistedSession();
  return { isAuthenticated: false, email: null, userId: null };
}

function handleGetStatus(_event) {
  return buildStatusPayload(_session);
}

// ---------------------------------------------------------------------------
// Registration — called once from app.whenReady()
// ---------------------------------------------------------------------------

/**
 * Restores any persisted session and registers the three auth IPC channels:
 *   auth:login      { email, password }  → { isAuthenticated, email, error? }
 *   auth:logout     (no payload)         → { isAuthenticated: false, email: null }
 *   auth:get-status (no payload)         → { isAuthenticated, email }
 *
 * This function is async because session restore may involve a network call to
 * refresh an expired access token. Awaiting it before createMainWindow() ensures
 * that the first auth:get-status call from the renderer returns the correct state.
 */
async function registerAuthIpc() {
  await restoreSession();

  ipcMain.handle("auth:login", handleLogin);
  ipcMain.handle("auth:logout", handleLogout);
  ipcMain.handle("auth:get-status", handleGetStatus);
}

/**
 * Returns a minimal session view for inter-module use within the main process.
 * Only access_token and user are exposed — refresh_token is never shared.
 * NEVER call this from the renderer or pass its return value through IPC.
 *
 * @returns {{ access_token: string, user: object } | null}
 */
function getSessionForInternal() {
  if (!_session) return null;
  return {
    access_token: _session.access_token,
    user: _session.user,
  };
}

module.exports = {
  registerAuthIpc,
  getSessionForInternal,
  // Exported for unit testing only; not called externally in production.
  restoreSession,
  buildStatusPayload,
};
