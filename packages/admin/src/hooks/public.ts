/**
 * Editor hooks (`@monti-cms/admin/hooks`). Hooks return state and results only: they never show a toast, open a dialog, navigate or touch
 * `window.history`, so a site can draw its own UI on them. The default admin UI is built on the same hooks.
 *
 * @experimental This entry point may change in a minor release until the installed components (Roadmap C) have used it.
 */

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
