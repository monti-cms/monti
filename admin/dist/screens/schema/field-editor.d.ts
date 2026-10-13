import { type FieldKindName, type FieldPlace, type Obj, type Rename } from "./schema-model.js";
export interface CollectionEditing {
    readonly collectionName: string;
    readonly collection: Obj;
    /** Changes the collection (the screen puts the result into the file). */
    readonly update: (change: (collection: Obj) => Obj) => void;
    /** A field or option was renamed: the review offers it as a rename. */
    readonly onRename: (rename: Rename) => void;
}
/** `inputOptions`: a JSON object of text, number and flag values, checked when the writer leaves the box. */
export declare function InputOptionsEditor({ value, onChange, }: {
    value: unknown;
    onChange: (value: Obj | undefined) => void;
}): import("react").JSX.Element;
/** What the kind of the field adds: its own options. */
export declare function KindOptions({ name, field, editing, set, change, }: {
    name: string;
    field: Obj;
    editing: CollectionEditing;
    set: (key: string, value: unknown) => void;
    change: (update: (field: Obj) => Obj) => void;
}): import("react").JSX.Element | null;
export declare const LOCALIZED_KINDS: readonly string[];
export declare function FieldEditor({ editing, place, name, field, index, count, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    name: string;
    field: Obj;
    index: number;
    count: number;
}): import("react").JSX.Element;
/**
 * The settings a new field needs, asked before it exists: the field is made in a copy of the collection and joins the real one only when its required
 * settings are complete, so there is never a half-made field in the file.
 */
export declare function NewFieldDialog({ editing, place, name, kind, onClose, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    name: string;
    kind: FieldKindName;
    onClose: (added: boolean) => void;
}): import("react").JSX.Element;
/** The fields of a collection (or of one branch of a conditional field), each editable, with a row to add one. */
export declare function FieldList({ editing, place, fields, kinds, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    fields: Record<string, Obj>;
    kinds: readonly FieldKindName[];
}): import("react").JSX.Element;
