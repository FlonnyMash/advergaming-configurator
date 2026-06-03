/** Must stay in sync with @advergaming/shared APP_DISPLAY_NAME. */
const APP_DISPLAY_NAME = "Mashed Games Studio";

/** Must stay in sync with dashboard project-paths + game-engine asset-loader rules. */
const ADVERGAMING_WORKSPACE_DIR_NAME = "MashedGamesStudio";
/** Pre-rename workspace folder; resolved when the new path does not exist yet. */
const LEGACY_ADVERGAMING_WORKSPACE_DIR_NAME = "AdvergamingStudio";
const ADVERGAMING_PROJECTS_DIR_NAME = "Projects";
const STUDIO_ASSET_PROTOCOL = "mashedgames-studio";

module.exports = {
  APP_DISPLAY_NAME,
  ADVERGAMING_WORKSPACE_DIR_NAME,
  LEGACY_ADVERGAMING_WORKSPACE_DIR_NAME,
  ADVERGAMING_PROJECTS_DIR_NAME,
  STUDIO_ASSET_PROTOCOL,
};
