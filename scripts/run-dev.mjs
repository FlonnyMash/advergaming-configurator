import { spawnSync } from "node:child_process";

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

const baseEnv = {
  ...process.env,
  NPM_CONFIG_PRODUCTION: "false",
};

// Ensure local toolchain binaries like vite/tsc are available before dev.
const installExitCode = run(
  "pnpm",
  ["install", "--prod=false", "--yes", "--no-optimistic-repeat-install"],
  baseEnv,
);
if (installExitCode !== 0) {
  process.exit(installExitCode);
}

const devExitCode = run(
  "pnpm",
  ["--parallel", "--filter", "dashboard", "--filter", "game-engine", "dev"],
  baseEnv,
);
process.exit(devExitCode);
