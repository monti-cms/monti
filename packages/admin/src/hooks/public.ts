/**
 * Editor hooks (`@monti-cms/admin/hooks`). Hooks return state and results only: they never show a toast, open a dialog, navigate or touch
 * `window.history`, so a site can draw its own UI on them. The default admin UI is built on the same hooks.
 *
 * @experimental This entry point may change in a minor release until the installed components (Roadmap C) have used it.
 */

export {
	type BlockChild,
	type BlockChildInit,
	type BlockEditor,
	type BlockEditorRaw,
	BlockFrame,
	type BlockFrameProps,
	type BlockTransaction,
	type BlockTransactionChild,
	type BlockValueInput,
	type BlockValues,
	type BlockView,
	Content,
	type ContentProps,
	useBlockEditor,
} from "../editor/blocks/use-block-editor";
export type { CmsIssue } from "../screens/api-error-message";
export {
	cmsEntryClient,
	type EntryBodyPayload,
	type EntryEditorClient,
	type EntrySaveInput,
	type EntryStatusAction,
	localRecoveryStore,
	type RecoveryRecord,
	type RecoveryStore,
} from "../screens/entries/entry-editor-client";
export type {
	ConflictInfo,
	EntryEditor,
	EntryEditorSnapshot,
	EntryEditorTarget,
	EntryLoadState,
	EntrySaveOutcome,
	FilledField,
	PublishOutcome,
	RecoveryOffer,
	SaveStatus,
	StatusOutcome,
	TranslationView,
} from "../screens/entries/entry-editor-store";
export type { EntryData, EntryForm, EntryFormPatch, FormValue } from "../screens/entries/entry-form";
export {
	EntryEditorProvider,
	type UseEntryEditorOptions,
	useEntryEditor,
	useEntryEditorContext,
} from "../screens/entries/use-entry-editor";
export {
	EntryFormProvider,
	type EntryFormValue,
	type FieldError,
	type FieldState,
	useField,
} from "../screens/entries/use-field";
export type {
	SlotAction,
	SlotApplyMode,
	SlotCandidate,
	SlotContext,
	SlotRequest,
	SlotResult,
	SlotSource,
} from "../slots/registry";
export {
	type SlotActionsOptions,
	type SlotActionsState,
	type SlotActionView,
	type SlotRunState,
	useSlotActions,
} from "../slots/use-slot-actions";
export { type EditorError, type EditorErrorCode, type EditorResult, toEditorError } from "./result";
