/** Must stay in sync with @mashedgames/shared APP_DISPLAY_NAME. */
const APP_DISPLAY_NAME = "Mashed Games Studio";

/** Must stay in sync with @mashedgames/shared BRAND_LOGO_FILENAME */
const BRAND_LOGO_FILENAME = "mashed-games-logo.png";

/** Must stay in sync with dashboard project-paths + game-engine asset-loader rules. */
const WORKSPACE_DIR_NAME = "MashedGamesStudio";
/** Pre-rename workspace folder; used when the new path does not exist yet. */
const LEGACY_WORKSPACE_DIR_NAME = "AdvergamingStudio";
const PROJECTS_DIR_NAME = "Projects";
const STUDIO_ASSET_PROTOCOL = "mashedgames-studio";

module.exports = {
  APP_DISPLAY_NAME,
  BRAND_LOGO_FILENAME,
  WORKSPACE_DIR_NAME,
  LEGACY_WORKSPACE_DIR_NAME,
  PROJECTS_DIR_NAME,
  STUDIO_ASSET_PROTOCOL,
};
