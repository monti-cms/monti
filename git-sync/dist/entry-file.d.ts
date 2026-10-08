import { type Cms, type Entry, type EntryBody } from "@monti-cms/core/plugin/server";
import { type ResolvedTarget } from "./options.js";
import type { PathPattern } from "./path-pattern.js";
/**
 * The file of a published entry, and the entry a file says.
 *
 * File format (one file per published entry and language): YAML front matter, then the body written by the target's format.
 *
 * - The title is always the key `title` (the field with the `title` role, whatever its name): the key a static site generator reads. On import `title` goes back
 *   to that field. The collection's own other fields (summary, tags, ...) are top-level front matter keys, as stored.A relation field is written as the **slug** of the entry it
 *   points to (a list of slugs for a many-relation), which is what a site's templates use. The exact ids are under `monti.refs` (`{ tagIds: [uuid, ...] }`), so the
 *   file imports back to the same entry even if the target was renamed since. The per-language names of a record collection are the nested `translations` mapping.
 * - `slug`, `date` (published) and `lastmod` (modified) are the keys a static site generator reads. `date` and `lastmod` are written for the site and ignored on import.
 * - `monti` names the entry: its `id`, `collection`, `locale`, and for a translation `translationOf` (the id of the source), and the relation `refs`. It pairs a file
 *   with its entry when the file is moved or renamed.
 * - On import a relation takes its ids from `monti.refs` when they still match the slugs written in the field (nobody edited the slugs); otherwise the slugs are
 *   looked up, which is what a file written by hand has. A slug no entry has is an import error.
 */
/** The file of a published entry. */
export interface ExportedEntry {
    /** Repo-relative path. */
    readonly path: string;
    readonly text: string;
    /** The git blob sha of `text`. */
    readonly blobSha: string;
    readonly slug: string;
    /** Content hash of the published entry the text was written from. */
    readonly contentHash: string;
}
/** Whether an entry has a published version with an address (the only kind that has a file). */
export declare const isSyncable: (entry: Entry | null, target: ResolvedTarget) => entry is Entry & {
    published: NonNullable<Entry["published"]>;
    publishedSlug: string;
};
/** The relation fields of a collection: name, the collection they point to, and whether they hold a list. */
export declare function relationFieldsOf(cms: Cms, collection: string): {
    name: string;
    to: string;
    many: boolean;
}[];
/** The front matter of an entry. Fields come in the order the collection declares them; relations are slugs with the exact ids under `monti.refs`. */
export declare function frontMatterOf(cms: Cms, entry: Entry, version: {
    readonly body: EntryBody;
    readonly slug: string;
}): Promise<Record<string, unknown>>;
/** Writes the file of a published entry through the target's format (`purpose: "sync"`, front matter included). */
export declare function exportEntry(cms: Cms, target: ResolvedTarget, pattern: PathPattern, entry: Entry & {
    published: NonNullable<Entry["published"]>;
    publishedSlug: string;
}): Promise<ExportedEntry>;
/** What a file says about its entry. */
export interface ParsedEntryFile {
    /** The collection fields (the front matter without the keys git-sync writes itself). */
    readonly metadata: Record<string, unknown>;
    readonly slug?: string;
    readonly id?: string;
    readonly collection?: string;
    readonly locale?: string;
    readonly translationOf?: string;
    /** `monti.refs`: the exact ids of relation fields, by field name. */
    readonly refs: Readonly<Record<string, readonly string[]>>;
    readonly body: string;
}
export type ParseEntryFileResult = {
    readonly ok: true;
    readonly file: ParsedEntryFile;
} | {
    readonly ok: false;
    readonly message: string;
};
/** Reads the text of a file into the entry it says. */
export declare function parseEntryFile(text: string): ParseEntryFileResult;
/** Whether two file texts say the same entry: the same fields, slug and body (the dates, which are only for the site, are not compared). */
export declare function sameContent(left: string, right: string): boolean;
/** What the relation fields of a file point to could not be found. Carries one message per field. */
export declare class RelationImportError extends Error {
    readonly problems: readonly string[];
    constructor(problems: readonly string[]);
}
/**
 * The metadata of a file with its relation fields turned into ids. A field takes the ids of `monti.refs` when each of them still has the slug the field says (or is
 * itself what the field says: an unpublished target is written as its id); otherwise every value is looked up as a slug of the field's target collection
 * (published first, then drafts, in the file's language and then the default one). A slug no entry has is an error that names the field and the slug.
 */
export declare function resolveRelations(cms: Cms, file: ParsedEntryFile, where: {
    readonly collection: string;
    readonly locale: string;
}): Promise<Record<string, unknown>>;
