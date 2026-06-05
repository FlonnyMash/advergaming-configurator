export {
  AssetReadyPayloadSchema,
  LoadExternalAssetPayloadSchema,
  SetRuntimeAssetsPayloadSchema,
  type AssetReadyPayload,
  type LoadExternalAssetPayload,
  type SetRuntimeAssetsPayload,
} from "./asset-bridge";

export {
  AssetReferenceSchema,
  NullableAssetStringSchema,
  coerceAssetReference,
  isDataUrlAsset,
  isProjectRelativeAssetPath,
  isStudioAssetUrl,
  isValidPersistedAssetString,
  parseAssetReference,
  type AssetReference,
} from "./asset-reference";

export {
  BRIDGE_MESSAGE_TYPE,
  AssetLoadErrorMessageSchema,
  AssetReadyMessageSchema,
  BridgeMessageSchema,
  ConfigUpdatedMessageSchema,
  EngineReadyMessageSchema,
  GameConfigSchema,
  GameEventMessageSchema,
  LoadExternalAssetMessageSchema,
  LoadTemplateMessageSchema,
  SetRuntimeAssetsMessageSchema,
  isAssetLoadErrorMessage,
  isConfigUpdatedMessage,
  isEngineReadyMessage,
  isGameEventMessage,
  isLoadTemplateMessage,
  parseBridgeMessage,
  parseGameConfig,
  type AssetLoadErrorMessage,
  type AssetLoadErrorPayload,
  type AssetReadyMessage,
  type BridgeMessage,
  type ConfigUpdatedMessage,
  type EngineReadyMessage,
  type GameConfig,
  type GameEventMessage,
  type LoadExternalAssetMessage,
  type LoadTemplateMessage,
  type SetRuntimeAssetsMessage,
} from "./game-config-bridge";

export {
  flattenLegacyConfig,
  getConfigValueAtPath,
  getDomOverlayForUi,
  getPrimaryBrandColor,
  mergeFlatConfigIntoTemplateJson,
  normalizeGameConfig,
} from "./config-flatten";

export {
  cloneForBridgePostMessage,
  DEFAULT_EDITOR_STATE,
  EditorStateSchema,
  encodeEntityId,
  HitboxUpdatedMessageSchema,
  HitboxUpdatePayloadSchema,
  isHitboxUpdatedMessage,
  parseEntityId,
  parseHitboxUpdatedMessage,
  type EditorState,
  type HitboxUpdatedMessage,
  type HitboxUpdatePayload,
} from "./editor-bridge";

export {
  AppModeSchema,
  AnimationClipMappingSchema,
  AnimationDefinitionSchema,
  ControlFieldSchemaSchema,
  ControlTypeSchema,
  ControlValueSchema,
  GameSchemaSchema,
  RewardRuleConfigSchema,
  SpriteSheetDefinitionSchema,
  WinConditionConfigSchema,
  type AnimationClipMapping,
  type AnimationDefinition,
  type AppMode,
  type ControlFieldSchema,
  type ControlType,
  type ControlValue,
  type GameSchema,
  type GameTemplateId,
  type RewardRuleConfig,
  type SpriteSheetDefinition,
  type SystemSettings,
  type WinConditionConfig,
} from "./game-schema";

export {
  parsePlayerTouchBridgePayload,
  parseTouchControlsStatePayload,
  PlayerTouchBridgePayloadSchema,
  STUDIO_TOUCH_BRIDGE_EVENTS,
  TouchControlsStatePayloadSchema,
  type PlayerTouchBridgePayload,
  type TouchControlsStatePayload,
} from "./studio-touch-bridge";

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
  DEFAULT_DEV_TOOLKIT_FLAGS,
  DEV_TOOLKIT_BRIDGE_EVENTS,
  DevToolkitAssetConfigBindingSchema,
  DevToolkitAssetLayoutSchema,
  DevToolkitFlagsSchema,
  DevToolkitHitboxLayoutSchema,
  DevToolkitPickedAssetSchema,
  DevToolkitSetFlagsPayloadSchema,
  DevToolkitVec2LayoutSchema,
  parseDevToolkitFlags,
  parseDevToolkitPickedAsset,
  parseDevToolkitSetFlagsPayload,
  sanitizeDevToolkitPickedAsset,
  type DevToolkitAssetConfigBinding,
  type DevToolkitAssetLayout,
  type DevToolkitFlags,
  type DevToolkitPickedAsset,
  type DevToolkitSetFlagsPayload,
} from "./dev-toolkit-bridge";

export {
  GAME_CHROME_BRIDGE_EVENTS,
  GameChromeOverlayDescriptorSchema,
  GameChromeOverlaysRegistryPayloadSchema,
  SetGameChromeOverlayVisibilityPayloadSchema,
  parseGameChromeOverlaysRegistryPayload,
  parseSetGameChromeOverlayVisibilityPayload,
  type GameChromeOverlayDescriptor,
  type GameChromeOverlaysRegistryPayload,
  type SetGameChromeOverlayVisibilityPayload,
} from "./game-chrome-bridge";

export {
  applyPath,
  buildConfigFromSchema,
  buildConfigWithFrozenSystem,
  exportClientPayload,
  getConfigValue,
  patchConfig,
  parseGameConfig as parseGameConfigFromUtils,
} from "./config-utils";

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
  controlsForMode,
  listControlChanges,
  listSchemaControlChanges,
  type ControlChange,
} from "./control-changes";

export {
  buildInitialClientPayload,
  buildProjectConfigFromClient,
  defaultProjectManifestFields,
  enrichClientMeta,
  slugifyProjectId,
} from "./project-utils";

export {
  groupControlsByElement,
  type ControlGroup,
} from "./control-grouping";

export {
  assertPermission,
  canAccess,
  filterSchemaByMode,
  filterSchemaControls,
  PermissionDeniedError,
  surfaceForMode,
  type RegistryResource,
} from "./permissions";

export {
  bumpSemverPatch,
  gameSchemaFromManifest,
  gameSchemaFromManifestForMode,
  isTemplateManifest,
  normalizeTemplateManifest,
  parseTemplateManifest,
  resolvePhaserSceneKeys,
  TemplateConfigJsonSchemaSchema,
  TemplateManifestSchema,
  type JsonSchemaControlExtension,
  type TemplateCatalogEntry,
  type TemplateConfigJsonSchema,
  type TemplateManifest,
  type TemplateManifestInput,
  type TemplateManifestStatus,
} from "./template-manifest";

export {
  DESKTOP_BUNDLED_TEMPLATE_ID,
  getDesktopBundledTemplateIds,
  resolveGameEngineBaseUrl,
  resolveTemplatePreviewUrl,
} from "./template-preview-url";

export {
  DEFAULT_GAME_CONFIG,
  DEFAULT_GAME_TEMPLATE_ID,
  DEFAULT_SCHEMA_VERSION,
  GAME_TEMPLATE_IDS,
  isGameTemplateId,
  parseGameTemplateId,
  type BuiltinGameTemplateId,
  type ConfigRootCategory,
  type ControlSchema,
  type ControlSurface,
  type DeepPartial,
  type PublishedTemplateBundle,
} from "./types";
