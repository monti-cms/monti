/**
 * The admin entry point (`@monti-cms/admin`): what a plugin's or a site's admin code needs, in one place. Registering (`defineAdminPlugin` with `pages`,
 * `components` and `slots`), the component types (`FieldViewProps`, `AdminComponents`, ...), calling the admin API (`useAdminFetch`, `adminFetch`, its errors,
 * `useCmsMutation`), building a block's edit view (`useBlockEditor`, `BlockFrame`, `Content`) and the editor hooks (`useField`, `useEntryEditor`, marked
 * `@experimental`), the parts of a block's edit view (`ContainerToolbar`, `BlockSettings`, `AttributeInput`, ...) and the site as admin code reads it (`useSite`,
 * `useTranslator`, `toPlainText`, ... from `@monti-cms/core/site`). A plugin's admin code needs only this entry point; screen parts (buttons, forms, lists) are in
 * `@monti-cms/admin/kit`, and the Tiptap-level editor API (marks over the editor, document conversion) is in `@monti-cms/admin/editor`.
 */

// The site, as admin code reads it. The same values as `@monti-cms/core/site`, so a plugin's admin code needs one entry point.
export {
	adminApiUrl,
	issueMessages,
	isUuid,
	type SchemaCollectionName,
	type Site,
	type Translator,
	toPlainText,
	useSite,
	useTranslator,
} from "@monti-cms/core/site";
export {
	type AdminComponents,
	AdminComponentsProvider,
	type BrowserFormat,
	type BrowserImportResult,
	type EditorExtension,
	type EditorExtensionContext,
	type EditorExtensionResult,
	type EditorInsertAction,
	type EditorMenuItem,
	type EditorSelectionAction,
	type FieldInputEntry,
	type FieldInputParts,
	type FieldViewProps,
	type ListCellProps,
	SOURCE_ERROR_ID,
	type SourcePanelProps,
	type SourcePanelRegistration,
	useAdminComponents,
	useFormat,
} from "./admin-components";
export * from "./api/index";
export {
	AttributeInput,
	BlockSettings,
	BlockSettingsField,
	ContainerToolbar,
	ToolbarButton,
} from "./editor/blocks/shared";
export { formatMeta, parseMeta } from "./editor/code-block/meta";
export * from "./hooks/public";
export { type AdminPanel, type AdminPanelProps, type AdminPlugin, defineAdminPlugin } from "./plugins";
export type { FieldContext, FieldInputProps } from "./screens/entries/field-inputs";
export {
	type OpenEditor,
	type OpenEditorEntry,
	OpenEditorProvider,
	type OpenEditorSelection,
	useOpenEditor,
} from "./screens/shared/open-editor";
export {
	type AdminScreen,
	type ScreenContextValue,
	useScreenContext,
} from "./screens/shared/screen-context";
