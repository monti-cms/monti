import type { CollectionEditing } from "./field-editor.js";
/**
 * The fields of a collection as one aligned tree in a single card: name and label, kind, and the settings in a few words, one line per field. The top-level
 * fields sit in the tabs and groups of the properties panel, with a preview of that panel beside the tree (or in a side panel on a narrower window). A
 * conditional field lists its choices as branches with their own fields under them. A row opens the field in a sheet on the right.
 */
export declare function FieldsCard({ editing }: {
    editing: CollectionEditing;
}): import("react").JSX.Element;
