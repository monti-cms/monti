import type { CollectionSchema } from "../../schema/collection.js";
import { type Field } from "../../schema/fields.js";
import { type IssueList } from "./issue.js";
/**
 * The rules about one field, by kind. They work on a field as `defineSite` normalizes it, so the same check serves the code config, the schema file and the admin's
 * field form (which asks what a field it is still building is missing).
 */
/** What a field is checked against: the collection it is in and the site's other collections. */
export interface FieldEnv {
    /** Every collection name of the site. */
    readonly collectionNames: readonly string[];
    /** The definitions of those collections, when the check can see them (a backlink needs the other side). */
    readonly collections?: Readonly<Record<string, CollectionSchema>>;
    /** The fields of the collection the field is in (a slug names the text field it is made from). */
    readonly fields: Readonly<Record<string, Field>>;
    /** The collection has a body (a text field can be filled from it). */
    readonly body: boolean;
}
/** Tab names on layout groups are short labels. */
export declare const TAB_NAME_MAX = 20;
/** Reports a tab name that is empty or too long. */
export declare function checkTabName(list: IssueList, path: string, tab: string | undefined): void;
/**
 * Checks one field at `path`: the settings its kind needs, and the names it points to (the text field a slug is made from, the collection a relation points to).
 * `name` is the key the field has; it is only used to refuse a reserved name.
 */
export declare function checkField(list: IssueList, path: string, name: string, field: Field, env: FieldEnv): void;
/** The role rules of a field: a role has the shape of a name, and the roles the core reads (`summary`, `title`) sit on text fields. */
export declare function checkRole(list: IssueList, path: string, field: Field): void;
