/**
 * Browser-side entry point of the admin UI. Used when a site or plugin adds components to the admin UI (code fence previews, field inputs, edit screen extensions)
 * (`CmsAdminComponentsProvider`).
 */
export { type BrowserFormat, type BrowserImportResult, type CmsAdminComponents, CmsAdminComponentsProvider, type EditorExtension, type EditorExtensionContext, type EditorExtensionResult, type EditorInsertAction, type EditorSelectionAction, type FieldInputEntry, type FieldInputParts, type FieldViewProps, type ListCellProps, SOURCE_ERROR_ID, type SourcePanelProps, type SourcePanelRegistration, useCmsAdminComponents, useFormat, } from "./admin-components.js";
export type { FieldContext, FieldInputProps } from "./screens/entries/field-inputs.js";
