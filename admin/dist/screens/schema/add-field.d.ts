import { type CollectionEditing } from "./field-editor.js";
import { type FieldPlace } from "./schema-model.js";
/**
 * Adds a field in one step: picking a kind shows its settings right below, so a wrong pick is fixed by picking another. The identifier follows the label (a
 * relation's follows its target, and so does its label) until the writer changes it. `onAdded` gets the name of the new field.
 */
export declare function AddFieldDialog({ editing, place, onClose, onAdded, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    onClose: () => void;
    onAdded: (name: string) => void;
}): import("react").JSX.Element;
