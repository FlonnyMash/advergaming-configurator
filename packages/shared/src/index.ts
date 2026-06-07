export {
  AssetReadyPayloadSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
  type AssetReadyPayload,
  type LoadExternalAssetPayload,
  type SetRuntimeAssetsPayload,
} from "./asset-bridge";

export {
  STUDIO_PROTOCOL,
  NullableAssetStringSchema,
  ProjectRelativePathSchema,
  StudioAssetUrlSchema,
  coerceAssetReference,
  isDataUrlAsset,
  isProjectRelativeAssetPath,
  isStudioAssetUrl,
  isValidPersistedAssetString,
  parseAssetReference,
  resolveStudioAssetUrl,
  type AssetReference,
} from "./asset-reference";

export {
  AppModeSchema,
  DEFAULT_GAME_CONFIG,
  DEFAULT_GAME_TEMPLATE_ID,
  DEFAULT_SCHEMA_VERSION,
  GameConfigSchema,
  exportClientPayload,
  getPrimaryBrandColor,
  normalizeGameConfig,
  parseGameConfig,
  patchConfig,
  patchFlatConfig,
  type AppMode,
  type GameConfig,
  type GameTemplateId,
} from "./flat-game-config";

export {
  FLAT_FIELD_REGISTRY,
  fieldsForMode,
  type FlatFieldDefinition,
  type FlatFieldSurface,
  type FlatFieldType,
} from "./flat-field-registry";

export {
  BRIDGE_MESSAGE_TYPE,
  AssetLoadErrorMessageSchema,
  AssetReadyMessageSchema,
  BridgeMessageSchema,
  EngineReadyMessageSchema,
  GameEventMessageSchema,
  LoadExternalAssetMessageSchema,
  LoadTemplateMessageSchema,
  SetRuntimeAssetsMessageSchema,
  UpdateConfigMessageSchema,
  isAssetLoadErrorMessage,
  isEngineReadyMessage,
  isGameEventMessage,
  isLoadTemplateMessage,
  isUpdateConfigMessage,
  parseBridgeMessage,
  type AssetLoadErrorMessage,
  type AssetLoadErrorPayload,
  type AssetReadyMessage,
  type BridgeMessage,
  type BridgeMessageType,
  type EngineReadyMessage,
  type GameEventMessage,
  type LoadExternalAssetMessage,
  type LoadTemplateMessage,
  type SetRuntimeAssetsMessage,
  type UpdateConfigMessage,
} from "./bridge-contract";

export {
  PROJECT_ID_PATTERN,
  ClientProjectPayloadSchema,
  GameProjectManifestSchema,
  ParentDriftItemSchema,
  ParentDriftReportSchema,
  ParentLockSnapshotSchema,
  type ClientProjectPayload,
  type GameProjectManifest,
  type ParentDriftItem,
  type ParentDriftReport,
  type ParentLockSnapshot,
} from "./game-project";

export {
  assertPermission,
  canAccess,
  filterFieldsByMode,
  getFieldsForMode,
  surfaceForMode,
  PermissionDeniedError,
  type RegistryResource,
} from "./permissions";

export {
  buildInitialClientPayload,
  buildProjectConfigFromClient,
  defaultProjectManifestFields,
  enrichClientMeta,
  slugifyProjectId,
} from "./project-utils";

export {
  APP_DISPLAY_NAME,
  BRAND_LOGO_FILENAME,
  BRAND_LOGO_URL_PATH,
  DEFAULT_PLATFORM_CONFIG,
  PlatformConfigSchema,
  PlatformFeaturesSchema,
  parsePlatformConfig,
  type PlatformConfig,
  type PlatformFeatures,
} from "./platform-schema";

export {
  DESKTOP_BUNDLED_TEMPLATE_ID,
  getDesktopBundledTemplateIds,
  resolveControlAssetPreviewSrc,
  resolveGameEngineBaseUrl,
  resolveTemplatePreviewUrl,
} from "./template-preview-url";

export {
  LIBRARY_DIR_NAME,
  PROJECTS_DIR_NAME,
  ensureWorkspaceExists,
  getLibraryRoot,
  getProjectsRoot,
  getWorkspacePathFromEnv,
  type EnsureWorkspaceOptions,
} from "./workspace";
