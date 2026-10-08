export type Obj = Record<string, unknown>;
export declare const isObj: (value: unknown) => value is Obj;
export declare const FIELD_KINDS: readonly ["text", "slug", "relation", "select", "media", "conditional", "backlink", "view"];
export type FieldKindName = (typeof FIELD_KINDS)[number];
/** The kinds a conditional field can show (the ones that store one value). */
export declare const VALUE_KINDS: readonly ["text", "relation", "select", "media"];
/** The order a field's properties are written in: the common ones, then the ones of the kind (the order of `schema.json`). */
export declare const FIELD_KEY_ORDER: readonly ["kind", "label", "description", "required", "localized", "input", "inputOptions", "hidden", "role", "tab", "fillFromBody", "multiline", "rows", "max", "from", "to", "many", "createInline", "publishedOnly", "allowUnpublished", "ordered", "view", "via", "accept", "options", "defaultValue", "discriminant", "values", "placeholder"];
export declare const COLLECTION_KEY_ORDER: readonly ["label", "kind", "icon", "path", "body", "fields", "layout", "list"];
/** `obj` with `key` set (or removed when `value` is `undefined`). A new key goes after the last key before it in `order` that is present, else at the end. */
export declare function setProp(obj: Obj, key: string, value: unknown, order?: readonly string[]): Obj;
/** `record` with the key `from` named `to`, in the same place. */
export declare function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T>;
/** `record` with `key` moved by `delta` places (negative: up). */
export declare function moveKey<T>(record: Record<string, T>, key: string, delta: number): Record<string, T>;
export declare function moveItem<T>(list: readonly T[], index: number, delta: number): T[];
/** Whether two JSON values are the same, key order included. */
export declare function sameJson(a: unknown, b: unknown): boolean;
/** A name for a field, option or collection: what the stored values and the JSON keys are called. */
export declare const NAME_PATTERN: RegExp;
/** Why `name` cannot be used among `taken` names, or `null`. */
export declare function nameProblem(name: string, taken: readonly string[]): "empty" | "pattern" | "reserved" | "taken" | null;
export declare const collectionsOf: (file: Obj) => Record<string, Obj>;
export declare const fieldsOf: (collection: Obj) => Record<string, Obj>;
export declare function setCollection(file: Obj, name: string, update: (collection: Obj) => Obj): Obj;
export declare function addCollection(file: Obj, name: string, kind: "document" | "item"): Obj;
export declare function removeCollection(file: Obj, name: string): Obj;
/** The names of the fields that store a value, including the fields a conditional field shows (the order the entry form has them). */
export declare function storedFieldNames(collection: Obj): string[];
/** Every name in `fields` or inside a conditional field, for the uniqueness of a new name (the stored values share one namespace). */
export declare function allFieldNames(collection: Obj): string[];
/** A field of `kind` with the properties it needs. */
export declare function newField(kind: FieldKindName, label: string, collections?: readonly string[]): Obj;
/** `field` as another kind: the common properties stay (the ones the new kind can have), the rest is the new kind's defaults. */
export declare function withKind(field: Obj, kind: FieldKindName, collections: readonly string[]): Obj;
/** A rename the writer made, so the review offers it as a rename (see `RenameInput` of the API). */
export type Rename = {
    kind: "field";
    collection: string;
    from: string;
    to: string;
} | {
    kind: "option";
    collection: string;
    field: string;
    from: string;
    to: string;
};
/** Records `from -> to`; a rename of a name that was renamed before extends it, and one that returns to the first name cancels it. */
export declare function recordRename(renames: readonly Rename[], next: Rename): Rename[];
/** Where a field lives in a collection: top level, or inside the branch of a conditional field. */
export type FieldPlace = {
    readonly branch?: {
        readonly field: string;
        readonly option: string;
    };
};
export declare function addField(collection: Obj, place: FieldPlace, name: string, field: Obj): Obj;
export declare function setField(collection: Obj, place: FieldPlace, name: string, update: (field: Obj) => Obj): Obj;
export declare function removeField(collection: Obj, place: FieldPlace, name: string): Obj;
export declare function moveField(collection: Obj, place: FieldPlace, name: string, delta: number): Obj;
/**
 * The name of the title field of a collection: the field with the `title` role, else the one named `title` (the file only has it at the top level of `fields`).
 * `undefined` when there is none.
 */
export declare function titleFieldName(collection: Obj): string | undefined;
/** Makes `name` the title field: it gets the `title` role, and the field that had it loses it. */
export declare function setTitleField(collection: Obj, name: string): Obj;
/**
 * Renames a field. The title field keeps being the title field under its new name: a title found by its name (the default) gets the `title` role, which is
 * what names it from then on.
 */
export declare function renameField(collection: Obj, place: FieldPlace, from: string, to: string): Obj;
/** The options of a select field, or of the discriminant of a conditional field. */
export declare function optionsOf(field: Obj): Record<string, string>;
export declare function addOption(field: Obj, value: string, label: string): Obj;
export declare function setOptionLabel(field: Obj, value: string, label: string): Obj;
export declare function renameOption(field: Obj, from: string, to: string): Obj;
export declare function removeOption(field: Obj, value: string): Obj;
export declare function moveOption(field: Obj, value: string, delta: number): Obj;
export declare function setDefaultOption(field: Obj, value: string): Obj;
export interface Allowed {
    blocks?: string[];
    marks?: string[];
    headings?: number[];
}
/** Whether a collection has a body (the file leaves it out for a document, which has one). */
export declare const hasBody: (collection: Obj) => boolean;
export declare const allowedOf: (collection: Obj) => Allowed;
/** The collection with its body written back: left out when it is the default of the kind and nothing is limited, a flag, or the object form. */
export declare function withBody(collection: Obj, enabled: boolean, allowed: Allowed): Obj;
export interface LayoutGroup {
    group?: string;
    fields: string[];
    collapsed?: boolean;
    tab?: string;
}
export declare const layoutOf: (collection: Obj) => LayoutGroup[];
export declare function withLayout(collection: Obj, layout: LayoutGroup[]): Obj;
export declare const columnsOf: (collection: Obj) => string[] | undefined;
export declare function withColumns(collection: Obj, columns: string[] | undefined): Obj;
/** The system columns a list can show next to the fields. */
export declare const SYSTEM_COLUMNS: readonly ["status", "locale", "updatedAt", "createdAt", "publishedAt", "folder"];
export interface Locale {
    code: string;
    name: string;
    label?: string;
}
export declare const localesOf: (file: Obj) => Locale[];
