const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { app, ipcMain } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const AdmZip = require("adm-zip");
const ws = require("ws");

// Mirrors the architecture doc's workspace layout: {workspace}/Templates/{slug}/
const TEMPLATES_DIR_NAME = "Templates";

// Template slugs follow the same shape as project IDs: lowercase alphanumeric + hyphens.
const TEMPLATE_SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const QUERY_TIMEOUT_MS = 10_000;

// Push channel for install lifecycle events forwarded to the renderer.
const TEMPLATE_INSTALL_PROGRESS_CHANNEL = "template:install-progress";

/**
 * @type {(() => Electron.BrowserWindow | null) | null}
 */
let _getMainWindow = null;

/**
 * @type {(() => { access_token: string, user: object } | null) | null}
 */
let _getSession = null;

/** Absolute path to the workspace root, set at registration time. */
let _workspacePath = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error(`Supabase query timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Authenticated PostgREST client — identical pattern to store-ipc-utils.js.
 */
function buildUserClient(accessToken) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[template-update] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { transport: ws },
  });
}

/**
 * Sends an install progress push event to the renderer.
 * Non-throwing — the install should continue even if the window is gone.
 */
function pushProgress(templateSlug, phase, percent = 0) {
  try {
    const win = _getMainWindow?.();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(TEMPLATE_INSTALL_PROGRESS_CHANNEL, {
      templateSlug,
      phase,
      percent,
    });
  } catch {
    // Silently ignore; losing a progress event is non-fatal.
  }
}

/**
 * Returns true if filePath is strictly inside parentDir (no ../ escape).
 * Used for both workspace root checks and zip-slip prevention.
 */
function isPathInside(filePath, parentDir) {
  const resolved = path.resolve(filePath);
  const resolvedParent = path.resolve(parentDir);
  const relative = path.relative(resolvedParent, resolved);
  if (!relative || relative === "") return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveTemplatesDir(workspacePath) {
  return path.join(workspacePath, TEMPLATES_DIR_NAME);
}

/**
 * Resolves and validates the installation directory for a template.
 * Returns null if the path would escape the workspace (traversal guard).
 */
function resolveTemplateDir(workspacePath, templateSlug) {
  const dir = path.normalize(
    path.join(workspacePath, TEMPLATES_DIR_NAME, templateSlug),
  );
  if (!isPathInside(dir, workspacePath)) return null;
  return dir;
}

/**
 * Computes the SHA-256 hex digest of a file via streaming (handles large bundles).
 */
function computeFileChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Builds the public download URL for a given storage key.
 *
 * Resolution order:
 *   1. MASHED_BUNDLE_BASE_URL env var (Cloudflare R2 public bucket URL)
 *   2. Supabase Storage public URL fallback
 */
function buildDownloadUrl(storageKey) {
  const baseUrl = process.env.MASHED_BUNDLE_BASE_URL?.replace(/\/+$/, "");
  if (baseUrl) {
    return `${baseUrl}/${storageKey}`;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/template-bundles/${storageKey}`;
  }

  throw new Error(
    "[template-update] Neither MASHED_BUNDLE_BASE_URL nor NEXT_PUBLIC_SUPABASE_URL is set.",
  );
}

// ---------------------------------------------------------------------------
// Download pipeline
// ---------------------------------------------------------------------------

/**
 * Streams a bundle download to a temp file, reporting byte-level progress.
 * Returns the absolute path of the downloaded temp file.
 *
 * @param {string} downloadUrl
 * @param {string} templateSlug   Used to name the temp file for diagnostics.
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<string>}
 */
async function downloadToTempFile(downloadUrl, templateSlug, onProgress) {
  const tempDir = app.getPath("temp");
  const tempFile = path.join(
    tempDir,
    `mashed-template-${templateSlug}-${Date.now()}.mgt`,
  );

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(
      `Bundle download failed: HTTP ${response.status} from ${downloadUrl}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  let received = 0;

  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(tempFile);
    const reader = response.body.getReader();

    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) {
          writeStream.end();
          return;
        }
        received += value.length;
        if (contentLength > 0) {
          onProgress(Math.round((received / contentLength) * 100));
        }
        // Respect backpressure.
        if (!writeStream.write(value)) {
          writeStream.once("drain", pump);
        } else {
          pump();
        }
      }).catch(reject);
    }

    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    pump();
  });

  return tempFile;
}

// ---------------------------------------------------------------------------
// Extraction pipeline
// ---------------------------------------------------------------------------

/**
 * Extracts a .mgt (renamed .zip) bundle into destDir.
 *
 * Zip-slip prevention: every entry path is resolved and verified to be
 * strictly inside destDir before any byte is written to disk.
 *
 * @param {string} zipPath   Absolute path to the downloaded .mgt file.
 * @param {string} destDir   Absolute path to the target extraction directory.
 */
function extractBundleToDir(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const resolvedDest = path.resolve(destDir);

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryTarget = path.normalize(
      path.join(resolvedDest, entry.entryName),
    );

    // Zip-slip guard: reject any entry resolving outside destDir.
    if (!entryTarget.startsWith(resolvedDest + path.sep)) {
      throw new Error(
        `[template-update] Zip-slip detected — entry "${entry.entryName}" escapes the target directory.`,
      );
    }

    fs.mkdirSync(path.dirname(entryTarget), { recursive: true });
    fs.writeFileSync(entryTarget, entry.getData());
  }
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

/**
 * IPC: template:check-version
 * Payload:  { templateSlug: string }
 * Response: { ok: true, templateId, version, storageKey, checksum } | { ok: false, error }
 *
 * Queries the Supabase `templates` table for the latest non-yanked version
 * of the given template slug. Returns safe metadata only — no raw DB rows.
 */
async function handleCheckVersion(_event, payload) {
  const templateSlug = payload?.templateSlug;

  if (!templateSlug || !TEMPLATE_SLUG_PATTERN.test(templateSlug)) {
    return { ok: false, error: "INVALID_TEMPLATE_SLUG" };
  }

  const session = _getSession?.();
  if (!session) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  let supabase;
  try {
    supabase = buildUserClient(session.access_token);
  } catch (err) {
    console.error("[template-update] check-version — failed to build client:", err.message);
    return { ok: false, error: "CLIENT_ERROR" };
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("templates")
        .select("id, version, storage_key, checksum")
        .eq("template_slug", templateSlug)
        .eq("is_latest", true)
        .eq("yanked", false)
        .maybeSingle(),
      QUERY_TIMEOUT_MS,
    );

    if (error) {
      console.error("[template-update] check-version query error:", error.message);
      return { ok: false, error: "QUERY_ERROR" };
    }

    if (!data) {
      return { ok: false, error: "TEMPLATE_NOT_FOUND" };
    }

    return {
      ok: true,
      templateId: data.id,
      version: data.version,
      storageKey: data.storage_key,
      checksum: data.checksum ?? null,
    };
  } catch (err) {
    console.error("[template-update] check-version unexpected error:", err.message);
    return { ok: false, error: "NETWORK_ERROR" };
  }
}

/**
 * IPC: template:get-installed-version
 * Payload:  { templateSlug: string }
 * Response: { ok: true, version: string | null } | { ok: false, error }
 *
 * Reads the locally installed manifest.json from the workspace Templates dir.
 * Returns { version: null } when the template is not yet installed.
 */
function handleGetInstalledVersion(_event, payload) {
  const templateSlug = payload?.templateSlug;

  if (!templateSlug || !TEMPLATE_SLUG_PATTERN.test(templateSlug)) {
    return { ok: false, error: "INVALID_TEMPLATE_SLUG" };
  }

  if (!_workspacePath) {
    return { ok: false, error: "WORKSPACE_NOT_READY" };
  }

  const templateDir = resolveTemplateDir(_workspacePath, templateSlug);
  if (!templateDir) {
    return { ok: false, error: "INVALID_TEMPLATE_SLUG" };
  }

  const manifestPath = path.join(templateDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { ok: true, version: null };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return { ok: true, version: manifest?.version ?? null };
  } catch (err) {
    console.error("[template-update] get-installed-version — manifest read error:", err.message);
    return { ok: false, error: "MANIFEST_READ_ERROR" };
  }
}

/**
 * IPC: template:install
 * Payload:  { templateSlug: string }
 * Response: { ok: true, version: string } | { ok: false, error }
 *
 * Full install pipeline:
 *   1. Fetch registry metadata (version, storage_key, checksum)
 *   2. Download .mgt bundle to a temp file (streaming with progress)
 *   3. SHA-256 verify against DB checksum
 *   4. Zip-slip-safe extraction into a temp staging directory
 *   5. Atomic rename of staging dir → final install dir
 *
 * All writes go to {workspace}/Templates/{templateSlug}/ — never to the
 * Electron .asar or app installation directory.
 */
async function handleInstall(_event, payload) {
  const templateSlug = payload?.templateSlug;

  if (!templateSlug || !TEMPLATE_SLUG_PATTERN.test(templateSlug)) {
    return { ok: false, error: "INVALID_TEMPLATE_SLUG" };
  }

  if (!_workspacePath) {
    return { ok: false, error: "WORKSPACE_NOT_READY" };
  }

  const templateDir = resolveTemplateDir(_workspacePath, templateSlug);
  if (!templateDir) {
    return { ok: false, error: "PATH_TRAVERSAL_DETECTED" };
  }

  const session = _getSession?.();
  if (!session) {
    return { ok: false, error: "NOT_AUTHENTICATED" };
  }

  // --- Step 1: Fetch registry metadata ---
  pushProgress(templateSlug, "checking", 0);

  let supabase;
  try {
    supabase = buildUserClient(session.access_token);
  } catch (err) {
    console.error("[template-update] install — failed to build client:", err.message);
    return { ok: false, error: "CLIENT_ERROR" };
  }

  let registryData;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("templates")
        .select("id, version, storage_key, checksum")
        .eq("template_slug", templateSlug)
        .eq("is_latest", true)
        .eq("yanked", false)
        .maybeSingle(),
      QUERY_TIMEOUT_MS,
    );

    if (error) {
      console.error("[template-update] install — registry query error:", error.message);
      return { ok: false, error: "QUERY_ERROR" };
    }

    if (!data) {
      return { ok: false, error: "TEMPLATE_NOT_FOUND" };
    }

    registryData = data;
  } catch (err) {
    console.error("[template-update] install — network error during registry query:", err.message);
    return { ok: false, error: "NETWORK_ERROR" };
  }

  // --- Step 2: Download to temp file ---
  pushProgress(templateSlug, "downloading", 0);

  let tempFile = null;
  try {
    const downloadUrl = buildDownloadUrl(registryData.storage_key);
    tempFile = await downloadToTempFile(downloadUrl, templateSlug, (percent) => {
      pushProgress(templateSlug, "downloading", percent);
    });
  } catch (err) {
    console.error("[template-update] install — download failed:", err.message);
    if (tempFile) {
      try { fs.unlinkSync(tempFile); } catch { /* ignore cleanup failure */ }
    }
    return { ok: false, error: "DOWNLOAD_FAILED" };
  }

  // --- Step 3: SHA-256 checksum verification ---
  pushProgress(templateSlug, "verifying", 0);

  try {
    if (registryData.checksum) {
      const actualChecksum = await computeFileChecksum(tempFile);
      // The checksum field may carry a "sha256:" prefix per the architecture doc.
      const expectedChecksum = registryData.checksum
        .replace(/^sha256:/, "")
        .toLowerCase();

      if (actualChecksum.toLowerCase() !== expectedChecksum) {
        console.error(
          "[template-update] Checksum mismatch for", templateSlug,
          "— expected:", expectedChecksum, "got:", actualChecksum,
        );
        try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
        return { ok: false, error: "CHECKSUM_MISMATCH" };
      }

      console.info("[template-update] Checksum verified for:", templateSlug);
    } else {
      // A missing checksum in the registry is logged but not fatal — allows
      // early-stage registry entries before checksums are computed server-side.
      console.warn(
        "[template-update] No checksum in registry for:", templateSlug,
        "— skipping verification.",
      );
    }
  } catch (err) {
    console.error("[template-update] install — checksum computation failed:", err.message);
    try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
    return { ok: false, error: "VERIFY_FAILED" };
  }

  // --- Step 4: Extract into a temp staging directory ---
  pushProgress(templateSlug, "extracting", 0);

  const stagingDir = `${templateDir}.staging-${Date.now()}`;
  try {
    fs.mkdirSync(stagingDir, { recursive: true });
    extractBundleToDir(tempFile, stagingDir);
    fs.unlinkSync(tempFile);
    tempFile = null;
  } catch (err) {
    console.error("[template-update] install — extraction failed:", err.message);
    if (tempFile) {
      try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
    }
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch { /* ignore */ }
    return { ok: false, error: "EXTRACT_FAILED" };
  }

  // --- Step 5: Atomic directory replacement ---
  pushProgress(templateSlug, "installing", 90);

  try {
    // Ensure the Templates directory exists before attempting the rename.
    fs.mkdirSync(resolveTemplatesDir(_workspacePath), { recursive: true });

    if (fs.existsSync(templateDir)) {
      fs.rmSync(templateDir, { recursive: true, force: true });
    }

    fs.renameSync(stagingDir, templateDir);
  } catch (err) {
    console.error("[template-update] install — atomic replace failed:", err.message);
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch { /* ignore */ }
    return { ok: false, error: "INSTALL_FAILED" };
  }

  pushProgress(templateSlug, "done", 100);
  console.info(
    "[template-update] Installed:", templateSlug, "v" + registryData.version,
    "→", templateDir,
  );
  return { ok: true, version: registryData.version };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Registers the three template update IPC channels.
 *
 * Must be called after registerAuthIpc() so the session is available, and
 * after ensureWorkspaceStructure() so workspacePath is valid.
 *
 * IPC channels:
 *   template:check-version        { templateSlug } → { ok, templateId, version, storageKey, checksum }
 *   template:get-installed-version { templateSlug } → { ok, version }
 *   template:install               { templateSlug } → { ok, version }
 *
 * Push events sent on "template:install-progress":
 *   { templateSlug, phase: 'checking'|'downloading'|'verifying'|'extracting'|'installing'|'done', percent }
 *
 * @param {() => { access_token: string, user: object } | null} getSession
 * @param {string} workspacePath
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
function registerTemplateUpdateIpc(getSession, workspacePath, getMainWindow) {
  if (typeof getSession !== "function") {
    throw new Error(
      "[template-update] registerTemplateUpdateIpc requires a getSession function.",
    );
  }
  if (typeof workspacePath !== "string" || !workspacePath) {
    throw new Error(
      "[template-update] registerTemplateUpdateIpc requires a non-empty workspacePath string.",
    );
  }
  if (typeof getMainWindow !== "function") {
    throw new Error(
      "[template-update] registerTemplateUpdateIpc requires a getMainWindow function.",
    );
  }

  _getSession = getSession;
  _workspacePath = workspacePath;
  _getMainWindow = getMainWindow;

  ipcMain.handle("template:check-version", handleCheckVersion);
  ipcMain.handle("template:get-installed-version", handleGetInstalledVersion);
  ipcMain.handle("template:install", handleInstall);
}

module.exports = { registerTemplateUpdateIpc, TEMPLATES_DIR_NAME };
