import { spawnSync } from "node:child_process";

const dashboardUrl = process.env.MASHEDGAMES_DASHBOARD_URL ?? "http://127.0.0.1:3000";
const waitTarget = `${dashboardUrl.replace(/\/+$/, "")}/`;

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

const env = {
  ...process.env,
  MASHEDGAMES_DASHBOARD_URL: dashboardUrl,
};

const waitExitCode = run(
  "pnpm",
  [
    "exec",
    "wait-on",
    `http-get://${waitTarget.replace(/^https?:\/\//, "")}`,
    "--timeout",
    "180000",
  ],
  env,
);

if (waitExitCode !== 0) {
  process.exit(waitExitCode);
}

const desktopExitCode = run(
  process.execPath,
  [
    "scripts/dev-desktop.mjs",
  ],
  env,
);

process.exit(desktopExitCode);
