import { type ReactNode } from "react";
import { type FieldKindName, type FieldPlace, type Obj, type Rename } from "./schema-model.js";
export interface CollectionEditing {
    readonly collectionName: string;
    readonly collection: Obj;
    /** Changes the collection (the screen puts the result into the file). */
    readonly update: (change: (collection: Obj) => Obj) => void;
    /** A field or option was renamed: the review offers it as a rename. */
    readonly onRename: (rename: Rename) => void;
    /** Changes the whole file, for an edit that reaches another collection (the other side of a relation). */
    readonly updateFile?: (change: (file: Obj) => Obj) => void;
}
/** The kinds a field can be switched to in its editor: the ones offered for a new field, and the kind it has now. */
export declare const kindChoices: (kind: FieldKindName) => readonly FieldKindName[];
/** Whether a many relation is also shown on its target, and the switch that changes it. Absent where the other side cannot be edited. */
export interface OppositeSwitch {
    readonly on: boolean;
    readonly onChange: (on: boolean) => void;
}
/** What the kind of the field adds: its own options. */
export declare function KindOptions({ name, field, editing, set, change, place, opposite, more, }: {
    name: string;
    field: Obj;
    editing: CollectionEditing;
    set: (key: string, value: unknown) => void;
    change: (update: (field: Obj) => Obj) => void;
    /** Where the field is: per-option fields exist only at the top level. */
    place?: FieldPlace;
    /** The switch that shows a many relation on its target too. */
    opposite?: OppositeSwitch;
    /** More settings to put under a relation's "More" (the add dialog's identifier). */
    more?: ReactNode;
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
/** The fields of one branch of a conditional field, each editable, with a button that adds one. */
export declare function FieldList({ editing, place, fields, }: {
    editing: CollectionEditing;
    place: FieldPlace;
    fields: Record<string, Obj>;
}): import("react").JSX.Element;
