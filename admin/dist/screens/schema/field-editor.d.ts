import { type FieldKindName, type FieldPlace, type Obj, type Rename } from "./schema-model.js";
interface CollectionEditing {
    readonly collectionName: string;
    readonly collection: Obj;
    /** Changes the collection (the screen puts the result into the file). */
    readonly update: (change: (collection: Obj) => Obj) => void;
    /** A field or option was renamed: the review offers it as a rename. */
    readonly onRename: (rename: Rename) => void;
}
export declare function FieldEditor({ editing, place, name, field, index, count, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    name: string;
    field: Obj;
    index: number;
    count: number;
}): import("react").JSX.Element;
/** The fields of a collection (or of one branch of a conditional field), each editable, with a row to add one. */
export declare function FieldList({ editing, place, fields, kinds, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    fields: Record<string, Obj>;
    kinds: readonly FieldKindName[];
}): import("react").JSX.Element;
export {};
