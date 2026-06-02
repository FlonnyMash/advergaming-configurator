export {
  BRIDGE_MESSAGE_TYPE,
  type BridgeMessage,
  type ConfigUpdateMode,
  type DiagnosticsPayloadMessage,
  type GameEventMessage,
  type IframeReadyMessage,
  type LoadTemplateMessage,
  type RequestDiagnosticsMessage,
  type UpdateConfigMessage,
  isBrandingPatch,
  isBrandingPatchShape,
  isDiagnosticsPayloadMessage,
  isGameEventMessage,
  isGameMasterConfig,
  isIframeReadyMessage,
  isLoadTemplateMessage,
  isRequestDiagnosticsMessage,
  isUpdateConfigMessage,
  parseBridgeMessage,
} from "./bridge";

export {
  AnimationClipMappingSchema,
  AnimationDefinitionSchema,
  BrandingPatchSchema,
  BrandingSettingsSchema,
  BridgeMessageSchema,
  ControlFieldSchemaSchema,
  ControlTypeSchema,
  ControlValueSchema,
  DiagnosticsPayloadMessageSchema,
  GameMasterConfigSchema,
  GameSchemaSchema,
  IframeReadyMessageSchema,
  LegacyGameMasterConfigSchema,
  LoadTemplateMessageSchema,
  RequestDiagnosticsMessageSchema,
  SystemSettingsSchema,
  UpdateConfigMessageSchema,
  parseBrandingPatch,
  parseGameMasterConfig,
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
  mergeBrandingPatch,
  migrateLegacyConfig,
  normalizeGameMasterConfig,
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
  type JsonSchemaControlExtension,
  type TemplateCatalogEntry,
  type TemplateConfigJsonSchema,
  type TemplateManifest,
  type TemplateManifestStatus,
} from "./template-manifest";

export {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_GAME_MASTER_CONFIG,
  DEFAULT_GAME_TEMPLATE_ID,
  DEFAULT_SCHEMA_VERSION,
  DEFAULT_SYSTEM_SETTINGS,
  GAME_TEMPLATE_IDS,
  getDomOverlayForUi,
  getPrimaryBrandColor,
  isGameTemplateId,
  isLegacyGameMasterConfig,
  parseGameTemplateId,
  type AnimationClipMapping,
  type AnimationDefinition,
  type AppMode,
  type BrandingPatch,
  type BrandingSettings,
  type BuiltinGameTemplateId,
  type ConfigRootCategory,
  type ControlFieldSchema,
  type ControlSchema,
  type ControlSurface,
  type ControlType,
  type ControlValue,
  type DeepPartial,
  type DOMOverlayConfig,
  type GameMasterConfig,
  type GameMasterConfigMeta,
  type GameplayConfig,
  type GameSchema,
  type GameTemplateId,
  type LegacyGameMasterConfig,
  type PublishedTemplateBundle,
  type RewardRuleConfig,
  type SpriteSheetDefinition,
  type SystemSettings,
  type ThemeConfig,
  type WinConditionConfig,
} from "./types";
