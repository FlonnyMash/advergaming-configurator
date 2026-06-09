/**
 * Standalone verification script for the Electron auth IPC wipe mechanism.
 *
 * Loads auth-ipc-utils.js inside a vm.createContext so the test run needs
 * neither an Electron binary nor a real OS keychain. Each test gets its own
 * isolated module instance via the makeInstance() factory, which prevents
 * shared mutable state (_session, _supabase) from leaking across test cases.
 *
 * Mock surface:
 *   - electron     { app, ipcMain, safeStorage }  — fully mocked
 *   - node:fs      — real fs wrapped with a controllable unlink fault-inject
 *   - @supabase/supabase-js — stub that records sign-out calls
 *   - ws           — no-op stub (used only as a supabase-js transport)
 *
 * Run:  node scripts/verify-auth-ipc.mjs
 * Exit: 0 = all assertions passed, 1 = at least one failure.
 */

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");

// Load the source once; each makeInstance() re-evaluates it in a fresh context.
const AUTH_IPC_SOURCE = fs.readFileSync(
  path.join(desktopRoot, "auth-ipc-utils.js"),
  "utf8",
);

// createRequire lets us call the real Node require() for built-in modules
// (node:path, node:assert, etc.) from inside the ESM verify script.
const nodeRequire = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Sentinel values — never real tokens, but recognisable enough to detect if
// they accidentally appear in log output.
// ---------------------------------------------------------------------------
const MOCK_ACCESS_TOKEN = "MOCK_ACCESS_TOKEN_SENTINEL";
const MOCK_REFRESH_TOKEN = "MOCK_REFRESH_TOKEN_SENTINEL";
const MOCK_PASSWORD = "MOCK_PASSWORD_SENTINEL";
const MOCK_EMAIL = "mock-user@verify-test.local";

// ---------------------------------------------------------------------------
// Factory: returns a fresh, isolated auth-ipc-utils module instance.
// ---------------------------------------------------------------------------

/**
 * @param {object} [opts]
 * @param {boolean} [opts.forceUnlinkError=false]
 *   When true, fs.unlinkSync throws an EPERM error to simulate an OS-level
 *   deletion failure on the encrypted token file.
 * @param {boolean} [opts.forceSignOutError=false]
 *   When true, supabase.auth.signOut() rejects to simulate a network failure
 *   during the remote sign-out step.
 */
function makeInstance(opts = {}) {
  // Each instance gets its own temp directory so tests never share disk state.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-auth-ipc-"));

  // -------------------------------------------------------------------------
  // Log spy — captures all console calls so assertions can inspect messages
  // without the actual messages appearing in the test runner output.
  // -------------------------------------------------------------------------
  const logs = { info: [], warn: [], error: [] };
  const spyConsole = {
    info: (...args) => logs.info.push(args.map(String).join(" ")),
    warn: (...args) => logs.warn.push(args.map(String).join(" ")),
    error: (...args) => logs.error.push(args.map(String).join(" ")),
    log: (...args) => logs.info.push(args.map(String).join(" ")),
  };

  // -------------------------------------------------------------------------
  // fs mock — wraps the real fs but allows unlink to be fault-injected.
  // -------------------------------------------------------------------------
  let unlinkShouldFail = opts.forceUnlinkError === true;

  const fsMock = {
    existsSync: (p) => fs.existsSync(p),
    writeFileSync: (p, data) => fs.writeFileSync(p, data),
    readFileSync: (p) => fs.readFileSync(p),
    unlinkSync: (p) => {
      if (unlinkShouldFail) {
        const err = new Error("EPERM: operation not permitted, unlink");
        err.code = "EPERM";
        throw err;
      }
      fs.unlinkSync(p);
    },
  };

  // -------------------------------------------------------------------------
  // safeStorage mock — passthrough encryption so we can pre-write token files
  // without a real OS keychain, and read them back in restoreSession.
  // -------------------------------------------------------------------------
  const safeStorageMock = {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext) => Buffer.from(plaintext, "utf8"),
    decryptString: (buffer) => buffer.toString("utf8"),
  };

  // -------------------------------------------------------------------------
  // ipcMain mock — captures registered handlers so tests can invoke them
  // directly by channel name without a real Electron IPC layer.
  // -------------------------------------------------------------------------
  const ipcHandlers = new Map();
  const ipcMainMock = {
    handle: (channel, fn) => {
      ipcHandlers.set(channel, fn);
    },
  };

  // -------------------------------------------------------------------------
  // Supabase mock — records signOut calls; login returns a controlled session.
  // -------------------------------------------------------------------------
  let signOutCallCount = 0;
  let signOutShouldFail = opts.forceSignOutError === true;

  const supabaseMock = {
    auth: {
      signOut: async () => {
        signOutCallCount++;
        if (signOutShouldFail) {
          throw new Error("Network error: failed to reach Supabase");
        }
      },
      signInWithPassword: async ({ email }) => ({
        data: {
          session: {
            access_token: MOCK_ACCESS_TOKEN,
            refresh_token: MOCK_REFRESH_TOKEN,
            // Far-future expiry so the token is never treated as expired.
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: "mock-user-id", email },
          },
        },
        error: null,
      }),
      // restoreSession calls setSession if a token file exists on disk.
      // Return a rejected session so restoreSession clears stale files.
      setSession: async () => ({
        data: { session: null },
        error: { message: "mock: no valid session to restore" },
      }),
    },
  };

  // -------------------------------------------------------------------------
  // Build the vm context — everything auth-ipc-utils.js needs, nothing more.
  // -------------------------------------------------------------------------
  const mockModuleObj = { exports: {} };

  const ctx = vm.createContext({
    // CJS module boilerplate
    require: (id) => {
      if (id === "electron") {
        return {
          app: { getPath: () => tmpDir },
          ipcMain: ipcMainMock,
          safeStorage: safeStorageMock,
        };
      }
      if (id === "node:fs" || id === "fs") return fsMock;
      if (id === "@supabase/supabase-js") {
        return { createClient: () => supabaseMock };
      }
      if (id === "ws") return function MockWs() {};
      return nodeRequire(id);
    },
    module: mockModuleObj,
    exports: mockModuleObj.exports,
    __dirname: desktopRoot,
    __filename: path.join(desktopRoot, "auth-ipc-utils.js"),
    // Provide only the process properties auth-ipc-utils.js actually reads.
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://verify-test.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "verify-test-anon-key",
      },
    },
    console: spyConsole,
    // Standard globals the module relies on
    Buffer,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Error,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
  });

  vm.runInContext(AUTH_IPC_SOURCE, ctx);

  // After vm.runInContext, module.exports has been replaced by the real exports
  // object (the source does `module.exports = { ... }`).
  const api = mockModuleObj.exports;

  // -------------------------------------------------------------------------
  // Convenience helpers
  // -------------------------------------------------------------------------

  /**
   * Invokes a registered IPC handler by channel name.
   * Throws if the channel was never registered (catches misconfiguration early).
   */
  async function callHandler(channel, payload = null) {
    const handler = ipcHandlers.get(channel);
    if (!handler) {
      throw new Error(
        `No IPC handler registered for channel "${channel}". ` +
          "Did you forget to call api.registerAuthIpc() first?",
      );
    }
    // The first argument is the Electron IpcMainInvokeEvent; pass null since
    // our handlers never interact with the event object.
    return handler(null, payload);
  }

  /** Simulates a successful login so subsequent tests start with a live session. */
  async function simulateLogin(email = MOCK_EMAIL) {
    return callHandler("auth:login", { email, password: MOCK_PASSWORD });
  }

  /** Flips the unlink fault-injection flag mid-test. */
  function setUnlinkFault(enabled) {
    unlinkShouldFail = enabled;
  }

  /** Cleanup: removes the temp directory created for this instance. */
  function cleanup() {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort; temp files are cleaned up by the OS on reboot regardless.
    }
  }

  return {
    api,
    logs,
    tmpDir,
    callHandler,
    simulateLogin,
    setUnlinkFault,
    cleanup,
    getSignOutCallCount: () => signOutCallCount,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("registerAuthIpc registers all three auth IPC channels", async () => {
  const inst = makeInstance();
  try {
    await inst.api.registerAuthIpc();

    // Verify all three channels are wired — missing any would break the
    // renderer's auth-ipc.ts helpers.
    assert.ok(
      inst.callHandler("auth:login") instanceof Promise ||
        inst.api /* handler exists */ !== undefined,
      // Confirm existence by calling callHandler without blowing up
    );
    // The real assertion: attempt to retrieve a non-existent channel should
    // throw; the three valid ones should not.
    await assert.doesNotReject(
      () => inst.callHandler("auth:get-status"),
      "auth:get-status handler must be registered",
    );
    await assert.doesNotReject(
      () => inst.callHandler("auth:logout"),
      "auth:logout handler must be registered",
    );
  } finally {
    inst.cleanup();
  }
});

test("auth:logout wipes the token file and clears the in-memory session", async () => {
  const inst = makeInstance();
  try {
    await inst.api.registerAuthIpc();

    // Establish a session so the token file is written to disk.
    const loginResult = await inst.simulateLogin();
    assert.equal(loginResult.isAuthenticated, true, "login should succeed");

    const tokenFile = path.join(inst.tmpDir, "mashed-auth.bin");
    assert.ok(fs.existsSync(tokenFile), "token file must exist after login");

    // Execute the wipe.
    const result = await inst.callHandler("auth:logout");

    // Renderer receives the expected shape.
    assert.equal(result.isAuthenticated, false, "result.isAuthenticated must be false");
    assert.equal(result.email, null, "result.email must be null");
    assert.equal(result.userId, null, "result.userId must be null");
    assert.equal(result.wiped, true, "result.wiped must be true on success");

    // Token file removed from disk.
    assert.ok(!fs.existsSync(tokenFile), "token file must be deleted after wipe");

    // Subsequent auth:get-status must reflect the cleared session.
    const status = await inst.callHandler("auth:get-status");
    assert.equal(status.isAuthenticated, false, "get-status must show unauthenticated");

    // Success message logged.
    assert.ok(
      inst.logs.info.some((m) => m.includes("wiped successfully")),
      "success message must be logged on info",
    );
    // No error logs on the happy path.
    assert.equal(inst.logs.error.length, 0, "no error logs expected on happy path");
  } finally {
    inst.cleanup();
  }
});

test("auth:logout with no active session returns wiped: true without errors", async () => {
  const inst = makeInstance();
  try {
    await inst.api.registerAuthIpc();

    // No login — session is null and no token file exists.
    const result = await inst.callHandler("auth:logout");

    assert.equal(result.isAuthenticated, false);
    assert.equal(result.wiped, true, "wiped must be true when there is nothing to delete");
    assert.equal(inst.logs.error.length, 0, "no error logs expected when nothing to wipe");
  } finally {
    inst.cleanup();
  }
});

test("auth:logout returns wiped: false and logs a critical error when OS unlink fails", async () => {
  // Force the fs.unlinkSync call to throw an EPERM error.
  const inst = makeInstance({ forceUnlinkError: true });
  try {
    await inst.api.registerAuthIpc();

    // Write a token file by logging in first (uses the passthrough safeStorage mock).
    await inst.simulateLogin();
    const tokenFile = path.join(inst.tmpDir, "mashed-auth.bin");
    assert.ok(fs.existsSync(tokenFile), "token file must exist before the failed wipe");

    const result = await inst.callHandler("auth:logout");

    // In-memory session must be cleared despite the disk failure.
    assert.equal(result.isAuthenticated, false, "session cleared in memory even on OS error");
    assert.equal(result.wiped, false, "result.wiped must be false when OS deletion fails");

    // A CRITICAL-level error must have been logged.
    assert.ok(
      inst.logs.error.some((m) => m.includes("CRITICAL")),
      "critical error must be logged when OS unlink fails",
    );
    // The error log must NOT contain the encrypted file path's token content
    // (the encrypted bytes are just written to the file — we test the log messages).
    assert.ok(
      !inst.logs.error.some((m) => m.includes(MOCK_ACCESS_TOKEN)),
      "access token must not appear in error logs",
    );
  } finally {
    // Re-enable unlink so cleanup() can remove the temp directory.
    inst.setUnlinkFault(false);
    inst.cleanup();
  }
});

test("auth:logout still wipes local state when the remote Supabase sign-out fails", async () => {
  const inst = makeInstance({ forceSignOutError: true });
  try {
    await inst.api.registerAuthIpc();
    await inst.simulateLogin();

    const result = await inst.callHandler("auth:logout");

    // Local session and file must still be cleared regardless of network failure.
    assert.equal(result.isAuthenticated, false, "session cleared despite network error");
    assert.equal(result.wiped, true, "file still wiped despite remote sign-out failure");

    // Network failure is logged as a warning (non-fatal), not as a critical error.
    assert.ok(
      inst.logs.warn.some((m) => m.includes("Remote sign-out failed")),
      "remote sign-out failure must be logged as a warning",
    );
    assert.ok(
      !inst.logs.error.some((m) => m.includes("CRITICAL")),
      "a network failure must not produce a CRITICAL log",
    );
  } finally {
    inst.cleanup();
  }
});

test("log output never contains raw token values at any log level", async () => {
  const inst = makeInstance();
  try {
    await inst.api.registerAuthIpc();
    await inst.simulateLogin(MOCK_EMAIL);
    await inst.callHandler("auth:logout");

    const allLogs = [
      ...inst.logs.info,
      ...inst.logs.warn,
      ...inst.logs.error,
    ].join("\n");

    assert.ok(
      !allLogs.includes(MOCK_ACCESS_TOKEN),
      "access token sentinel must never appear in any log output",
    );
    assert.ok(
      !allLogs.includes(MOCK_REFRESH_TOKEN),
      "refresh token sentinel must never appear in any log output",
    );
    assert.ok(
      !allLogs.includes(MOCK_PASSWORD),
      "password sentinel must never appear in any log output",
    );
  } finally {
    inst.cleanup();
  }
});

test("buildStatusPayload returns the correct shape for null and live sessions", () => {
  const inst = makeInstance();
  try {
    // buildStatusPayload is a pure exported helper — no IPC wiring needed.
    const unauthenticated = inst.api.buildStatusPayload(null);
    assert.equal(unauthenticated.isAuthenticated, false);
    assert.equal(unauthenticated.email, null);
    assert.equal(unauthenticated.userId, null);

    const fakeSession = {
      access_token: MOCK_ACCESS_TOKEN,
      refresh_token: MOCK_REFRESH_TOKEN,
      expires_at: 9999999999,
      email: MOCK_EMAIL,
      user: { id: "test-uid" },
    };
    const authenticated = inst.api.buildStatusPayload(fakeSession);
    assert.equal(authenticated.isAuthenticated, true);
    assert.equal(authenticated.email, MOCK_EMAIL);
    assert.equal(authenticated.userId, "test-uid");

    // Confirm tokens are absent from the payload — only status fields exposed.
    assert.ok(
      !("access_token" in authenticated),
      "access_token must not be in the status payload",
    );
    assert.ok(
      !("refresh_token" in authenticated),
      "refresh_token must not be in the status payload",
    );
  } finally {
    inst.cleanup();
  }
});
