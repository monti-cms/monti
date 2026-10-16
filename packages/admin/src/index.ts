/**
 * The admin entry point (`@monti-cms/admin`): what a plugin's or a site's admin code needs, in one place. Registering (`defineAdminPlugin` with `pages`,
 * `components` and `slots`), the component types (`FieldViewProps`, `AdminComponents`, ...), calling the admin API (`useAdminFetch`, `adminFetch`, its errors,
 * `useCmsMutation`), building a block's edit view (`useBlockEditor`, `BlockFrame`, `Content`) and the editor hooks (`useField`, `useEntryEditor`, marked
 * `@experimental`). UI parts are in `@monti-cms/admin/kit`, `@monti-cms/admin/blocks` and `@monti-cms/admin/editor`.
 */
export {
	type AdminComponents,
	AdminComponentsProvider,
	type BrowserFormat,
	type BrowserImportResult,
	type EditorExtension,
	type EditorExtensionContext,
	type EditorExtensionResult,
	type EditorInsertAction,
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
export * from "./hooks/public";
export { type AdminPlugin, defineAdminPlugin } from "./plugins";
export type { FieldContext, FieldInputProps } from "./screens/entries/field-inputs";
