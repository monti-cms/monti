import type { CollectionSchema } from "./collection.js";
import { type FieldRole, type TextField, type ValueField } from "./fields.js";
/**
 * Pure function that reads one collection definition. It reads no site, so it is used by extensions the config file imports
 * (e.g. an extension's field checks and public-page helpers) and by `defineSite`. The functions that look a collection up by name are members of a `Site` (`createSchemas` in `derive.ts`).
 */
/** A field stored as one value in the metadata. The choice value of a conditional field and its dependent fields are each flattened to one. */
export interface StoredField {
    readonly name: string;
    readonly field: ValueField;
    /** If this is a field dependent on a conditional field, that condition. The value is kept only when the condition matches. */
    readonly when?: {
        readonly field: string;
        readonly value: string;
    };
}
/** Stored field list. Follows declaration order, and fields dependent on a conditional field come right after that field. */
export declare function valueFieldsOf(schema: Pick<CollectionSchema, "fields">): StoredField[];
/** The stored field with that role (`role`). `undefined` if none. */
export declare function fieldWithRole(schema: Pick<CollectionSchema, "fields">, role: FieldRole): StoredField | undefined;
/** The value (string) of that role's field. `""` if the field is missing or the value is not a string. */
export declare function valueWithRole(schema: Pick<CollectionSchema, "fields">, role: FieldRole, values: {
    readonly [key: string]: unknown;
}): string;
/** The title field of a collection: a stored text field. */
export type TitleField = StoredField & {
    readonly field: TextField;
};
/**
 * The title field of a collection: the field with the `title` role, or, when none has it, the field named `title`. `undefined` if there is none
 * (`defineSite` rejects such a collection, so a checked config always has one). This is the only place that knows the default name:
 * everything that reads or writes the title (SQL included, see `titleExpr`) goes through it.
 */
export declare function findTitleField(schema: Pick<CollectionSchema, "fields">): TitleField | undefined;
/** The title field of a (checked) collection. Throws if there is none, which `defineSite` has already rejected. */
export declare function titleFieldOf(schema: Pick<CollectionSchema, "fields">): TitleField;
/** The title in stored values (metadata): the value of the title field. `null` if it is not a string. */
export declare function titleValue(schema: Pick<CollectionSchema, "fields">, values: {
    readonly [key: string]: unknown;
}): string | null;
