import { type Collection } from "@monti-cms/core/client";
import { type EntryData, type EntryFormPatch } from "./entries/entry-form.js";
export type RecordTarget = {
    collection: Collection;
    id: string | null;
};
/**
 * Taxonomy (category, tag, series) edit panel. Opens beside the list. `저장` validates and then applies straight to the public values, and
 * there is no autosave. The panel stays open after saving (for a new item, it switches to open the item the parent created).
 * Closing with unsaved changes asks whether to discard. Each locale tab above shows whether a translation exists, and on other locale tabs only that locale's name and description are edited.
 * A series' post list and slug are the same in all locales, so they are edited on the default locale tab. Unpublished posts can be included too.
 */
export declare function RecordPanel({ target, onClose, onSaved, onDirtyChange, initial, className, }: {
    target: RecordTarget;
    onClose: () => void;
    /** After saving (a new item is added). Passes the item the server returned. */
    onSaved: (saved: EntryData) => void;
    /** When unsaved changes appear or go away. Used to ask before the list opens another item. */
    onDirtyChange?: (dirty: boolean) => void;
    /** Initial values of a new item (e.g. a name when added by search term in the entry edit screen). */
    initial?: EntryFormPatch;
    className?: string;
}): import("react").JSX.Element;
