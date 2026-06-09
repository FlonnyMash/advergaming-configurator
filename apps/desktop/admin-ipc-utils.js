const { ipcMain } = require("electron");

/** @type {(() => { access_token: string, user: object } | null) | null} */
let _getSession = null;
/** @type {(() => string | null) | null} */
let _getDashboardBaseUrl = null;

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

async function callDashboardApi(pathname, init = {}) {
  if (!_getSession || !_getDashboardBaseUrl) {
    return { ok: false, status: 500, error: "ADMIN_IPC_NOT_INITIALIZED" };
  }

  const session = _getSession();
  if (!session?.access_token) {
    return { ok: false, status: 401, error: "SESSION_EXPIRED" };
  }

  const baseUrl = _getDashboardBaseUrl();
  if (!baseUrl) {
    return { ok: false, status: 503, error: "DASHBOARD_NOT_READY" };
  }

  const url = `${normalizeBaseUrl(baseUrl)}${pathname}`;
  const headers = {
    ...(init.headers ?? {}),
    Authorization: `Bearer ${session.access_token}`,
  };

  try {
    const response = await fetch(url, { ...init, headers });
    const body = await response.json().catch(() => null);

    if (!response.ok || !body) {
      return {
        ok: false,
        status: response.status,
        error:
          body && typeof body.error === "string"
            ? body.error
            : `HTTP_${response.status}`,
      };
    }

    return body;
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error: err instanceof Error ? err.message : "NETWORK_ERROR",
    };
  }
}

async function handleAdminPublishTemplate(_event, payload) {
  return callDashboardApi("/api/admin/publish-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
}

async function handleAdminRefData() {
  return callDashboardApi("/api/admin/ref-data");
}

async function handleAdminProvisionLicense(_event, payload) {
  return callDashboardApi("/api/provision-license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
}

function registerAdminIpc(getSession, getDashboardBaseUrl) {
  if (typeof getSession !== "function") {
    throw new Error("[admin-ipc] registerAdminIpc requires a getSession function.");
  }
  if (typeof getDashboardBaseUrl !== "function") {
    throw new Error(
      "[admin-ipc] registerAdminIpc requires a getDashboardBaseUrl function.",
    );
  }

  _getSession = getSession;
  _getDashboardBaseUrl = getDashboardBaseUrl;

  ipcMain.handle("admin:publish-template", handleAdminPublishTemplate);
  ipcMain.handle("admin:ref-data", handleAdminRefData);
  ipcMain.handle("admin:provision-license", handleAdminProvisionLicense);
}

module.exports = { registerAdminIpc };

