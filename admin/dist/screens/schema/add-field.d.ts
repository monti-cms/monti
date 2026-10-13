import { type CollectionEditing } from "./field-editor.js";
import { type FieldPlace } from "./schema-model.js";
/**
 * Adds a field in two steps: a name and a kind first; a kind that cannot exist without settings (a choice, a relation, a conditional field...) then asks for them in
 * a second dialog before the field is made. `onAdded` gets the name of the new field so the caller can open its editor.
 */
export declare function AddFieldDialog({ editing, place, onClose, onAdded, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    onClose: () => void;
    onAdded: (name: string) => void;
}): import("react").JSX.Element;
