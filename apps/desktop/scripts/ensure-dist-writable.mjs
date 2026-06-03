import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const winUnpacked = path.join(desktopRoot, "dist", "win-unpacked");

function removeWinUnpacked() {
  if (!fs.existsSync(winUnpacked)) {
    return;
  }
  fs.rmSync(winUnpacked, { recursive: true, force: true });
}

try {
  removeWinUnpacked();
} catch (error) {
  const locked =
    error instanceof Error &&
    ("code" in error) &&
    (error.code === "EBUSY" || error.code === "EPERM" || error.code === "EACCES");

  if (locked) {
    console.error(
      [
        "Cannot clear apps/desktop/dist/win-unpacked before packaging.",
        "",
        "Another program is using files in that folder (often Cursor with app.asar open,",
        "File Explorer preview, or a running Mashed Games Studio build).",
        "",
        "Fix:",
        "  1. Close any editor tabs under apps/desktop/dist/",
        "  2. Quit Mashed Games Studio if it is running",
        "  3. Close File Explorer windows showing dist\\win-unpacked",
        "  4. Run: pnpm build:desktop",
      ].join("\n"),
    );
    process.exit(1);
  }

  throw error;
}
