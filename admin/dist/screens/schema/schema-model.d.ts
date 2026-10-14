/**
 * The schema file as the settings screen edits it: plain data, changed by small pure functions that return a new copy. Key order is part of the file, so every
 * helper keeps it: a renamed key stays where it was, a new property goes where the format puts it (see `FIELD_KEY_ORDER`), and moving is an explicit step.
 */
import { type PluginFieldSet } from "@monti-cms/core/client";
export type Obj = Record<string, unknown>;
export declare const isObj: (value: unknown) => value is Obj;
export declare const FIELD_KINDS: readonly ["text", "slug", "relation", "select", "media", "conditional", "backlink", "view"];
export type FieldKindName = (typeof FIELD_KINDS)[number];
/** The kinds a conditional field can show (the ones that store one value). */
export declare const VALUE_KINDS: readonly ["text", "relation", "select", "media"];
/** The order a field's properties are written in: the common ones, then the ones of the kind (the order of the field format in `format.ts` of core). */
export declare const FIELD_KEY_ORDER: readonly ["kind", "label", "description", "required", "localized", "input", "inputOptions", "role", "fillFromBody", "multiline", "rows", "max", "from", "to", "many", "createInline", "publishedOnly", "allowUnpublished", "ordered", "view", "via", "accept", "options", "defaultValue", "discriminant", "values", "placeholder"];
export declare const COLLECTION_KEY_ORDER: readonly ["label", "kind", "icon", "path", "body", "fields", "layout"];
/** `obj` with `key` set (or removed when `value` is `undefined`). A new key goes after the last key before it in `order` that is present, else at the end. */
export declare function setProp(obj: Obj, key: string, value: unknown, order?: readonly string[]): Obj;
/** The `site` or `admin` settings of the file (empty when it has none). */
export declare const sectionOf: (file: Obj, section: "site" | "admin") => Obj;
/** `file` with one setting of `site` or `admin` set (or removed when `value` is `undefined`); a section left empty is removed. */
export declare function setSetting(file: Obj, section: "site" | "admin", key: string, value: unknown): Obj;
/** One changed setting of `site` or `admin`: its path (`site.name`) and the value before and after (`undefined` when not set). */
export interface SettingChange {
    readonly path: string;
    readonly from: unknown;
    readonly to: unknown;
}
/** The settings of `site` and `admin` that differ between the saved file and the draft, in the order of the draft. */
export declare function settingChanges(base: Obj, draft: Obj): SettingChange[];
/**
 * How many things differ between the saved file and the draft: each collection that was added, removed or edited, each of the language settings
 * (`locales`, `defaultLocale`, `timeZone`) and each changed `site` or `admin` setting. The number shown as unsaved changes.
 */
export declare function changeCount(base: Obj, draft: Obj): number;
/** `record` with the key `from` named `to`, in the same place. */
export declare function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T>;
/** `record` with `key` moved by `delta` places (negative: up). */
export declare function moveKey<T>(record: Record<string, T>, key: string, delta: number): Record<string, T>;
/** `list` with the item at `index` moved by `delta` places (negative: up). */
export declare function moveItem<T>(list: readonly T[], index: number, delta: number): T[];
/** Whether two JSON values are the same, key order included. */
export declare function sameJson(a: unknown, b: unknown): boolean;
/** Why `name` cannot be used among `taken` names, or `null`. */
export declare function nameProblem(name: string, taken: readonly string[]): "empty" | "pattern" | "reserved" | "taken" | null;
export declare const collectionsOf: (file: Obj) => Record<string, Obj>;
export declare const fieldsOf: (collection: Obj) => Record<string, Obj>;
export declare function setCollection(file: Obj, name: string, update: (collection: Obj) => Obj): Obj;
/** The public address a new document collection starts with, from its name. */
export declare const defaultPath: (id: string) => string;
/** The identifier a display name suggests: lowercase ASCII words joined with `-` ("Blog posts" -> "blog-posts"). Empty when the name has no ASCII letters or digits (Korean). */
export declare const idFromName: (name: string) => string;
/** Why a public address cannot be used (the file wants a `/` first and `:slug` once), or `null`. Empty is fine: the entries have no public page. */
export declare function pathProblem(path: string): "slash" | "slug" | null;
/** A new collection: every collection needs a title, and a slug is what the public address is made from, so both start in place. */
export declare function addCollection(file: Obj, name: string, kind: "document" | "item", path?: string, label?: string): Obj;
export declare function removeCollection(file: Obj, name: string): Obj;
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
/** The fields of a plugin's field set added after the others, under names the collection does not use yet. */
export declare function addFieldSet(collection: Obj, set: Pick<PluginFieldSet, "fields">): Obj;
export declare function setField(collection: Obj, place: FieldPlace, name: string, update: (field: Obj) => Obj): Obj;
export declare function removeField(collection: Obj, place: FieldPlace, name: string): Obj;
export declare function moveField(collection: Obj, place: FieldPlace, name: string, delta: number): Obj;
/** Puts `name` where `over` is (a field dropped on another one of the same list); any other name leaves the list as it is. */
export declare function reorderField(collection: Obj, place: FieldPlace, name: string, over: string): Obj;
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
export declare function withLayout(collection: Obj, layout: LayoutGroup[]): Obj;
export interface Locale {
    code: string;
    name: string;
    label?: string;
}
export declare const localesOf: (file: Obj) => Locale[];
/** The field `name` at `place`, or `undefined`. */
export declare function fieldAt(collection: Obj, place: FieldPlace, name: string): Obj | undefined;
/** The kinds that cannot be added with a name alone: they open their settings first. */
export declare const KINDS_WITH_SETTINGS: readonly FieldKindName[];
export type FieldProblem = "options" | "optionLabel" | "branches" | "target" | "slugFrom" | "backlink" | "view";
/**
 * What is still missing from `field` before it can be added (the settings its kind requires), in the order the form shows them. Empty: it is complete. The rules are
 * core's (`checkField`, the ones `defineSite` applies to the saved file); the form only turns the codes into the names its messages use.
 */
export declare function fieldProblems(field: Obj, collection: Obj, collectionNames: readonly string[]): FieldProblem[];
/**
 * Why a field cannot be deleted, or `null`. The title field is what names every entry; the slug field cannot go while the public address is made from `:slug`.
 * Only top-level fields: the file does not take either of them inside a conditional field.
 */
export declare function removeBlock(collection: Obj, place: FieldPlace, name: string): "title" | "slug" | null;
