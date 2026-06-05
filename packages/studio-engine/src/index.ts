export { StudioSidebar } from "./ui/StudioSidebar";
export {
  StudioTemplateCatalog,
  type StudioTemplateCatalogProps,
} from "./ui/StudioTemplateCatalog";
export { StudioConfigJsonTools } from "./ui/StudioConfigJsonTools";
export {
  SchemaControlPanel,
  controlInputClass,
  type SchemaControlPanelProps,
} from "./ui/SchemaControlPanel";
export {
  useStudioConfigStore,
  selectStudioConfig,
} from "./store/useStudioConfigStore";
export {
  cloneGameConfig,
  hasUnsavedGameControls,
  listGameControlChanges,
  studioControlsForSchema,
} from "./lib/game-controls-state";
export {
  getStudioGameSchema,
  getStudioTemplateOptions,
  getStudioCatalogEntries,
} from "./registry/studioSchemaRegistry";
