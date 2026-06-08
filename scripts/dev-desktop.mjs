import { spawnSync } from "node:child_process";
import {
  resolveDesktopRoot,
  resolveElectronCli,
} from "./resolve-electron-cli.mjs";

const desktopRoot = resolveDesktopRoot();
const electronCli = resolveElectronCli(desktopRoot);
const dashboardUrl = process.env.MASHEDGAMES_DASHBOARD_URL ?? "http://127.0.0.1:3000";

const result = spawnSync(process.execPath, [electronCli, "."], {
  cwd: desktopRoot,
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    NODE_ENV: "development",
    MASHEDGAMES_ELECTRON_DEV: "1",
    MASHEDGAMES_DASHBOARD_URL: dashboardUrl,
    NEXT_PUBLIC_MASHED_DEV_STORE_PREVIEW:
      process.env.NEXT_PUBLIC_MASHED_DEV_STORE_PREVIEW ?? "1",
    MASHEDGAMES_DEV_STORE_PREVIEW:
      process.env.MASHEDGAMES_DEV_STORE_PREVIEW ?? "1",
  },
});

process.exit(result.status ?? 1);