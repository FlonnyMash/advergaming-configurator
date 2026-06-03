import { statSync } from "node:fs";
import path from "node:path";
import { BRAND_LOGO_FILENAME, BRAND_LOGO_URL_PATH } from "@mashedgames/shared";

export { BRAND_LOGO_INTRINSIC_SIZE } from "@/lib/brand-logo-constants";

/** Cache-bust in dev so replacing public/mashed-games-logo.png shows on refresh. */
export function brandLogoSrc(urlPath = BRAND_LOGO_URL_PATH): string {
  if (urlPath !== BRAND_LOGO_URL_PATH) {
    return urlPath;
  }

  try {
    const logoPath = path.join(process.cwd(), "public", BRAND_LOGO_FILENAME);
    const mtime = statSync(logoPath).mtimeMs;
    return `${urlPath}?v=${mtime}`;
  } catch {
    return urlPath;
  }
}
