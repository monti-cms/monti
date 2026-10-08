/**
 * What the front matter keys of a post usually mean: the one table `monti init` reads to shape the starter schema from the front matter of the posts the app already has.
 * To change how a key is understood, edit a row. A key that is in no row gets a plain field. Keys are compared in lower case.
 */
export type KeyRole = "publishedAt" | "draft" | "published" | "state" | "summary" | "locale" | "tag" | "category" | "series";
export interface KeyRow {
    readonly role: KeyRole;
    readonly keys: readonly string[];
    readonly note: string;
}
export declare const KEY_TABLE: readonly KeyRow[];
/** The keys of the given roles, in lower case. */
export declare const keysOf: (...roles: KeyRole[]) => ReadonlySet<string>;
/** Keys that hold the publish date: the schema gets no field for them. */
export declare const DATE_KEYS: ReadonlySet<string>;
/** Keys that hold the short description of a post. */
export declare const SUMMARY_KEYS: ReadonlySet<string>;
/** Keys that hold the language of a post. */
export declare const LOCALE_KEYS: ReadonlySet<string>;
/** Keys the CMS keeps itself (publish state), so no field is made for them. */
export declare const CMS_STATE_KEYS: ReadonlySet<string>;
/** Keys that hold terms and so become relations to entries of another collection. The value is the collection the key most likely means. */
export declare const RELATION_KEYS: Readonly<Record<string, string>>;
