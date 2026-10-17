/**
 * Editor hooks, exported from `@monti-cms/admin`. Hooks return state and results only: they never show a toast, open a dialog, navigate or touch
 * `window.history`, so a site can draw its own UI on them. The default admin UI is built on the same hooks.
 *
 * The block view hooks (`useBlockEditor`, `BlockFrame`, `Content`) are what a block's edit view is built with. The entry editor hooks (`useField`,
 * `useEntryEditor`, ...) are `@experimental`: they may change in a minor release until the installed components (Roadmap C) have used them.
 */
export { adminEntryClient, } from "../api/entries.js";
export { BlockFrame, Content, useBlockEditor, } from "../editor/blocks/use-block-editor.js";
export { useLinkPaths } from "../editor/link-targets.js";
export { localRecoveryStoreOf } from "../screens/entries/entry-editor-client.js";
export { EntryEditorProvider, useEntryEditor, useEntryEditorContext, } from "../screens/entries/use-entry-editor.js";
export { EntryFormProvider, useField, } from "../screens/entries/use-field.js";
export { useSlotActions, } from "../slots/use-slot-actions.js";
export { toEditorError } from "./result.js";
