export interface DraftEditorOptions<T> {
    /** What the server holds now, or `null` for an item that does not exist yet. */
    saved: T | null;
    /** The blank draft of a new item. A new item with nothing entered has nothing to discard. */
    empty: T;
    /** Whether two drafts read the same. Defaults to comparing their JSON. */
    equals?: (a: T, b: T) => boolean;
    /** Told when unsaved changes appear or go away (and `false` when the editor goes away). A new function each render is fine. */
    onDirtyChange?: (dirty: boolean) => void;
    /** The save and delete requests in flight, so the editor can say it is `busy`. */
    saving?: boolean;
    deleting?: boolean;
}
export interface DraftEditor<T> {
    draft: T;
    /** Changes the draft: a patch of fields, or a function from the current draft. */
    update: (change: Partial<T> | ((draft: T) => T)) => void;
    /** Replaces the whole draft. */
    replace: (next: T) => void;
    /** Throws the edits away: back to what the server holds (or the blank draft). */
    reset: () => void;
    /** Whether there is something to lose: a saved item that differs from the server's, or a new item that differs from the blank draft. */
    dirty: boolean;
    isNew: boolean;
    saving: boolean;
    deleting: boolean;
    /** Saving or deleting: the form should not take input. */
    busy: boolean;
}
/**
 * The edit state every form that saves one item shares: the draft, whether it holds unsaved changes (new and existing items alike), and the
 * report of that to the parent. When `saved` changes (after a save, or the server's copy was refreshed) the draft follows it.
 */
export declare function useDraftEditor<T>({ saved, empty, equals, onDirtyChange, saving, deleting, }: DraftEditorOptions<T>): DraftEditor<T>;
