import type { CollectionSchema } from "./collection.js";
import type { FieldRole, ValueField } from "./fields.js";
/**
 * Pure function that reads one collection definition. It does not read the site config (`config/resolved.ts`), so it is used by extensions the config file imports
 * (e.g. an extension's field checks and public-page helpers) and by `defineConfig`. The function that looks up by name in the config is in `derive.ts`.
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
