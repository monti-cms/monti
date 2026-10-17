/**
 * Editor hooks, exported from `@monti-cms/admin`. Hooks return state and results only: they never show a toast, open a dialog, navigate or touch
 * `window.history`, so a site can draw its own UI on them. The default admin UI is built on the same hooks.
 *
 * The block view hooks (`useBlockEditor`, `BlockFrame`, `Content`) are what a block's edit view is built with. The entry editor hooks (`useField`,
 * `useEntryEditor`, ...) are `@experimental`: they may change in a minor release until the installed components (Roadmap C) have used them.
 */
export { adminEntryClient, type EntryBodyPayload, type EntryEditorClient, type EntrySaveInput, type EntryStatusAction, } from "../api/entries.js";
export { type BlockChild, type BlockChildInit, type BlockEditor, type BlockEditorRaw, BlockFrame, type BlockFrameProps, type BlockTransaction, type BlockTransactionChild, type BlockValueInput, type BlockValues, type BlockView, Content, type ContentProps, useBlockEditor, } from "../editor/blocks/use-block-editor.js";
export { useLinkPaths } from "../editor/link-targets.js";
export { localRecoveryStoreOf, type RecoveryRecord, type RecoveryStore } from "../screens/entries/entry-editor-client.js";
export type { ConflictInfo, EntryEditor, EntryEditorSnapshot, EntryEditorTarget, EntryLoadState, EntrySaveOutcome, FilledField, PublishOutcome, RecoveryOffer, SaveStatus, StatusOutcome, TranslationView, } from "../screens/entries/entry-editor-types.js";
export type { EntryFormPatch } from "../screens/entries/entry-form.js";
export { EntryEditorProvider, type UseEntryEditorOptions, useEntryEditor, useEntryEditorContext, } from "../screens/entries/use-entry-editor.js";
export { EntryFormProvider, type EntryFormValue, type FieldError, type FieldState, useField, } from "../screens/entries/use-field.js";
export { type SlotActionsOptions, type SlotActionsState, type SlotActionView, type SlotRunState, useSlotActions, } from "../slots/use-slot-actions.js";
export { type EditorError, type EditorErrorCode, type EditorResult, toEditorError } from "./result.js";
