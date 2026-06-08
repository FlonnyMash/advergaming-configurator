import { spawnSync } from "node:child_process";

const mode = process.argv[2];

if (mode !== "client" && mode !== "studio") {
  console.error(
    'Usage: node scripts/build-release.mjs <client|studio>',
  );
  process.exit(1);
}

const isStudioMode = mode === "studio" ? "true" : "false";
const baseEnv = {
  ...process.env,
  NEXT_PUBLIC_ENABLE_STUDIO_MODE: isStudioMode,
};

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env,
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  if (result.error) {
    console.error(result.error.message);
  }
  return 1;
}

// Ensure build-time toolchain binaries (tsc, vite, etc.) are present.
// Some local workflows leave the workspace in a production-only install state.
const installExitCode = run(
  "pnpm",
  ["install", "--prod=false", "--yes", "--no-optimistic-repeat-install"],
  baseEnv,
);
if (installExitCode !== 0) {
  process.exit(installExitCode);
}

const result = run("pnpm", ["run", "build:desktop"], baseEnv);

process.exit(result);
