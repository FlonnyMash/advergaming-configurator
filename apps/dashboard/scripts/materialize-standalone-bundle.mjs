import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(scriptDir, "..");
const monorepoRoot = path.resolve(dashboardRoot, "../..");

/** Always copied into the app node_modules (flat) for Electron/NSIS installs. */
const RUNTIME_PACKAGES = [
  "@swc/helpers",
  "@next/env",
  "styled-jsx",
  "react",
  "react-dom",
];

function findPnpmPackageDir(storeRoot, pnpmEntryPrefix, packageName) {
  const pnpmDir = path.join(storeRoot, "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmDir)) {
    return null;
  }

  const entry = fs
    .readdirSync(pnpmDir)
    .find(
      (name) =>
        name === pnpmEntryPrefix ||
        name.startsWith(`${pnpmEntryPrefix}@`),
    );
  if (!entry) {
    return null;
  }

  const [scope, name] = packageParts(packageName);
  return scope
    ? path.join(pnpmDir, entry, "node_modules", scope, name)
    : path.join(pnpmDir, entry, "node_modules", packageName);
}

function packageParts(packageName) {
  if (packageName.startsWith("@")) {
    const slash = packageName.indexOf("/");
    return [packageName.slice(0, slash), packageName.slice(slash + 1)];
  }
  return [null, packageName];
}

function destinationForPackage(nodeModulesDir, packageName) {
  const [scope, name] = packageParts(packageName);
  return scope
    ? path.join(nodeModulesDir, scope, name)
    : path.join(nodeModulesDir, name);
}

function copyRealDir(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing package directory: ${from}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, dereference: true });
}

function resolveRuntimePackageSource(packageName) {
  const pnpmEntryPrefix = packageName.replace("/", "+");
  const fromMonorepo = findPnpmPackageDir(
    monorepoRoot,
    pnpmEntryPrefix,
    packageName,
  );
  if (fromMonorepo && fs.existsSync(fromMonorepo)) {
    return fromMonorepo;
  }

  const fromDashboard = findPnpmPackageDir(
    dashboardRoot,
    pnpmEntryPrefix,
    packageName,
  );
  if (fromDashboard && fs.existsSync(fromDashboard)) {
    return fromDashboard;
  }

  throw new Error(
    `Could not locate ${packageName} in pnpm store for standalone materialization.`,
  );
}

function materializeSymlink(linkPath) {
  const linkType = fs.lstatSync(linkPath);
  if (!linkType.isSymbolicLink()) {
    return;
  }

  const target = fs.readlinkSync(linkPath);
  const resolvedTarget = path.resolve(path.dirname(linkPath), target);
  const tempPath = `${linkPath}.materializing`;

  fs.rmSync(tempPath, { recursive: true, force: true });
  fs.cpSync(resolvedTarget, tempPath, { recursive: true, dereference: true });
  fs.rmSync(linkPath, { recursive: true, force: true });
  fs.renameSync(tempPath, linkPath);
}

function materializeSymlinksInDir(rootDir) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isSymbolicLink()) {
      materializeSymlink(fullPath);
      if (fs.statSync(fullPath).isDirectory()) {
        materializeSymlinksInDir(fullPath);
      }
      continue;
    }

    if (entry.isDirectory()) {
      materializeSymlinksInDir(fullPath);
    }
  }
}

function seedAppRuntimePackages(appNodeModulesDir) {
  for (const packageName of RUNTIME_PACKAGES) {
    const source = resolveRuntimePackageSource(packageName);
    const destination = destinationForPackage(appNodeModulesDir, packageName);
    copyRealDir(source, destination);
    console.log(
      `[materialize-standalone] copied ${packageName} -> ${path.relative(dashboardRoot, destination)}`,
    );
  }
}

function tracingRootForServerJson(rootDir) {
  return rootDir.replace(/\\/g, "\\\\");
}

/** Next serializes absolute monorepo paths into standalone server.js at build time. */
export function patchStandaloneServerTracingRoots(serverJsPath, monorepoRoot) {
  if (!fs.existsSync(serverJsPath)) {
    return;
  }

  const tracingRoot = tracingRootForServerJson(monorepoRoot);
  let content = fs.readFileSync(serverJsPath, "utf8");

  content = content.replace(
    /"outputFileTracingRoot":"[^"]*"/,
    `"outputFileTracingRoot":"${tracingRoot}"`,
  );
  content = content.replace(
    /"turbopack":\{"root":"[^"]*"\}/,
    `"turbopack":{"root":"${tracingRoot}"}`,
  );

  fs.writeFileSync(serverJsPath, content);
}

function seedNextSiblingPackages(standaloneRoot, appNodeModulesDir) {
  const pnpmDir = path.join(standaloneRoot, "node_modules", ".pnpm");
  const nextEntry = fs
    .readdirSync(pnpmDir)
    .find((name) => name.startsWith("next@"));
  if (!nextEntry) {
    return;
  }

  const nextSiblingsDir = path.join(pnpmDir, nextEntry, "node_modules");
  for (const sibling of fs.readdirSync(nextSiblingsDir, { withFileTypes: true })) {
    if (sibling.name === "next") {
      continue;
    }

    const source = path.join(nextSiblingsDir, sibling.name);
    const destination = path.join(appNodeModulesDir, sibling.name);
    if (fs.existsSync(destination)) {
      continue;
    }

    copyRealDir(source, destination);
    console.log(
      `[materialize-standalone] copied next sibling ${sibling.name} -> ${path.relative(dashboardRoot, destination)}`,
    );
  }
}

export function materializeStandaloneBundle() {
  const standaloneRoot = path.join(dashboardRoot, ".next", "standalone");
  const appNodeModulesDir = path.join(
    standaloneRoot,
    "apps",
    "dashboard",
    "node_modules",
  );

  if (!fs.existsSync(standaloneRoot)) {
    throw new Error(`Missing standalone output: ${standaloneRoot}`);
  }

  seedAppRuntimePackages(appNodeModulesDir);
  materializeSymlinksInDir(standaloneRoot);
  seedNextSiblingPackages(standaloneRoot, appNodeModulesDir);

  const serverJsPath = path.join(standaloneRoot, "apps", "dashboard", "server.js");
  patchStandaloneServerTracingRoots(serverJsPath, monorepoRoot);
  console.log("[materialize-standalone] patched standalone server.js tracing roots");

  console.log("[materialize-standalone] dereferenced standalone symlinks");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  materializeStandaloneBundle();
}
