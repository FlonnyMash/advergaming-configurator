const fs = require("node:fs");
const path = require("node:path");
const { PROJECTS_DIR_NAME, PROJECT_ID_PATTERN } = require("./constants");

const CONFIG_FILE_NAME = "config.json";
const MAX_CONFIG_BYTES = 64 * 1024; // 64 KB — far exceeds any valid GameConfig

function isPathInsideWorkspace(filePath, workspacePath) {
  const resolvedFile = path.resolve(filePath);
  const resolvedWorkspace = path.resolve(workspacePath);
  const relative = path.relative(resolvedWorkspace, resolvedFile);
  if (!relative || relative === "") {
    return true;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return true;
}

function resolveProjectConfigPath(workspacePath, projectId) {
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return null;
  }

  const resolved = path.normalize(
    path.join(workspacePath, PROJECTS_DIR_NAME, projectId, CONFIG_FILE_NAME),
  );

  if (!isPathInsideWorkspace(resolved, workspacePath)) {
    return null;
  }

  return resolved;
}

function saveFlatConfig(workspacePath, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }

  const { projectId, config } = payload;

  if (typeof projectId !== "string") {
    throw new Error("Invalid projectId.");
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Invalid config: must be a plain object.");
  }

  const configPath = resolveProjectConfigPath(workspacePath, projectId);
  if (!configPath) {
    throw new Error("Invalid project ID or path traversal detected.");
  }

  let json;
  try {
    json = JSON.stringify(config, null, 2);
  } catch {
    throw new Error("Config could not be serialized to JSON.");
  }

  if (Buffer.byteLength(json, "utf8") > MAX_CONFIG_BYTES) {
    throw new Error("Config payload exceeds the 64 KB limit.");
  }

  const projectDir = path.dirname(configPath);
  try {
    fs.mkdirSync(projectDir, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create project directory "${projectDir}": ${message}`,
    );
  }

  try {
    fs.writeFileSync(configPath, json, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write config to "${configPath}": ${message}`);
  }

  return { ok: true };
}

function loadFlatConfig(workspacePath, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }

  const { projectId } = payload;

  if (typeof projectId !== "string") {
    throw new Error("Invalid projectId.");
  }

  const configPath = resolveProjectConfigPath(workspacePath, projectId);
  if (!configPath) {
    throw new Error("Invalid project ID or path traversal detected.");
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No saved config found for project "${projectId}". Save the project first.`,
    );
  }

  let raw;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config from "${configPath}": ${message}`);
  }

  return { ok: true, raw };
}

function getProjectList(workspacePath) {
  const projectsDir = path.join(workspacePath, PROJECTS_DIR_NAME);
  if (!fs.existsSync(projectsDir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => {
      if (!e.isDirectory() || !PROJECT_ID_PATTERN.test(e.name)) return false;
      const configPath = path.join(projectsDir, e.name, CONFIG_FILE_NAME);
      return fs.existsSync(configPath);
    })
    .map((e) => e.name);
}

module.exports = {
  CONFIG_FILE_NAME,
  isPathInsideWorkspace,
  resolveProjectConfigPath,
  saveFlatConfig,
  loadFlatConfig,
  getProjectList,
};
