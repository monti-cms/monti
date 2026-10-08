/**
 * Editor hooks (`@monti-cms/admin/hooks`). Hooks return state and results only: they never show a toast, open a dialog, navigate or touch
 * `window.history`, so a site can draw its own UI on them. The default admin UI is built on the same hooks.
 *
 * @experimental This entry point may change in a minor release until the installed components (Roadmap C) have used it.
 */
export { BlockFrame, Content, useBlockEditor, } from "../editor/blocks/use-block-editor.js";
export { useLinkPaths } from "../editor/link-targets.js";
export { cmsEntryClient, localRecoveryStoreOf, } from "../screens/entries/entry-editor-client.js";
export { EntryEditorProvider, useEntryEditor, useEntryEditorContext, } from "../screens/entries/use-entry-editor.js";
export { EntryFormProvider, useField, } from "../screens/entries/use-field.js";
export { useSlotActions, } from "../slots/use-slot-actions.js";
export { toEditorError } from "./result.js";
