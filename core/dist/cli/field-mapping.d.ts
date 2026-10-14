import type { ContentFolder, FrontMatterKey } from "./init-detect.js";
/** A key from front matter as a field name: kept as it is when it is one word of letters and digits, else camel-cased. `undefined` if nothing usable is left. */
export declare function fieldNameOf(key: string): string | undefined;
type SchemaField = Record<string, unknown>;
/** What the starter schema holds, and what was decided on the way (for the init report). */
export interface StarterSchema {
    /** `post` first, then the collections its relations point to. */
    readonly collections: Record<string, {
        readonly fields: Record<string, SchemaField>;
    } & Record<string, unknown>>;
    /** Plain-words lines about front matter keys that got a relation, or that need no field. */
    readonly notes: string[];
}
/**
 * The collections of the starter schema: `post` with the fields every blog has, then (when a content folder was found) one field per front matter key, read by the
 * table in `front-matter-keys.ts`:
 *
 * - `date` and the other publish date keys get no field: the entry has its own publish date.
 * - `description`, `summary`, `excerpt` and the like become the field with the `summary` role.
 * - `tags` (also `keywords`, `topics`) become the collection `tag` and a relation `tagIds`. `category` becomes `category` and `categoryId`, and `categories` (a list)
 *   `categoryIds`.
 * - `draft`, `published` and the language keys are the CMS's own and get no field.
 */
export declare function starterCollections(keys: readonly FrontMatterKey[], multiLocale: boolean): StarterSchema;
/** The public address shape for a content folder: its last folder name (`content/blog` -> `/blog/:slug`), else `/posts/:slug`. */
export declare function pathFor(folder: ContentFolder | undefined): string;
export {};
