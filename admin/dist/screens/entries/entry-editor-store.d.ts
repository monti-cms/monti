import type { EntryEditorConfig, EntryEditorCore } from "./entry-editor-types.js";
/** The longest wait for Korean IME composition to end before a save. After that the composition marker is taken as stale and the save goes on. */
export declare const COMPOSITION_WAIT_MS = 1000;
/** The marker the view carries so `EntryEditorProvider` can find the engine behind a value `useEntryEditor` returned. */
export declare const ENTRY_EDITOR_CORE: unique symbol;
/**
 * The entry editor's engine: the state machine behind `useEntryEditor`, written without React so it can be driven by a test or another UI.
 *
 * It keeps a form with a browser recovery copy and sends it to the server only when told to. Per entry it holds: the form, its baseline (the last
 * server save), the save status, a recovery copy in the {@link RecoveryStore}, and the conflict and recovery offers.
 *
 * - The recovery copy is written once input pauses for `RECOVERY_IDLE_MS` (browser only, never sent to the server), and right away on `flushRecovery()`
 *   (leaving the screen, hiding the tab) and when a save starts.
 * - One request at a time. Input during a send goes out on the next explicit save.
 * - The recovery copy is kept even on a network or server error. Retries are sent only when the user asks (`retry`).
 * - If the session expires, the recovery copy is kept and the user is guided to sign in again.
 *
 * @internal
 */
export declare function createEntryEditor(config: EntryEditorConfig): EntryEditorCore;
