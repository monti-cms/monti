import { type CollectionEditing } from "./field-editor.js";
import { type FieldPlace } from "./schema-model.js";
/**
 * The editor of one field, in a sheet on the right. Edits go to a copy of the collection: Apply puts the copy into the file, Cancel (or closing the sheet)
 * drops it. Deleting a field is the one thing that acts at once, as a change of the file that the review still shows.
 */
export declare function FieldSheet({ editing, place, name, onClose, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    name: string;
    onClose: () => void;
}): import("react").JSX.Element;
