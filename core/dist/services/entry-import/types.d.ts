import type { Cms } from "../../cms/index.js";
import type { CmsError } from "../../core/store/errors.js";
import type { StoredDocument } from "../../doc/stored-document.js";
/** Why an entry was skipped, or what went wrong with it. `code` is the stable name; the route writes the person's text from it (`reasonText`). */
export interface ImportReason {
    readonly code: ImportReasonCode;
    readonly params?: Readonly<Record<string, string | number>>;
    /** For `write_failed`: the error the write threw. Only the route reads it, to write the text; it never goes out as it is. */
    readonly error?: CmsError;
}
export type ImportReasonCode = "item_collection" | "no_collection" | "skipped_by_choice" | "no_title" | "slug_exists" | "slug_repeated" | "locale_unknown" | "locale_not_default" | "source_missing" | "source_skipped" | "no_body" | "unreadable" | "front_matter_invalid" | "title_from_slug" | "body_unparsed" | "links_kept" | "images_left_out" | "draft_missing" | "write_failed" | "unexpected";
/** The body of an archive entry, in the form the import reads it. */
export type SourceBody = {
    readonly kind: "text";
    readonly format: string;
    readonly text: string;
} | {
    readonly kind: "doc";
    readonly doc: StoredDocument;
};
/** One entry of an archive, as far as an import reads it: its title, slug, language, group and body. */
export interface SourceEntry {
    /** Names the entry within the archive: its id in an export, its file path in a folder of text files. */
    readonly key: string;
    /** The collection folder of the archive. */
    readonly collection: string;
    readonly locale: string;
    /** Entries with one group are the translations of one entry. In an export it is `translationGroupId`; the source's key is the group's key. */
    readonly group: string;
    /** Whether this entry is the source of its group (not a translation). */
    readonly isSource: boolean;
    /** The title of a text file's front matter. An export holds it in `metadata`, under the name of its title field, so this is `null` there. */
    readonly title: string | null;
    readonly slug: string | null;
    /** The values the archive holds besides the slug: an export's metadata, a text file's front matter without `title`, `slug` and `locale`. */
    readonly metadata: Readonly<Record<string, unknown>>;
    /** The archive said it was published (an export's status; a text file never says so). */
    readonly published: boolean;
    /** `null` when the archive holds no readable body. */
    readonly body: SourceBody | null;
    /** Set when the entry cannot be read at all. */
    readonly problem?: ImportReason;
}
export type ImportKind = "export" | "markdown";
/** What was found in an uploaded archive. */
export interface ImportSource {
    readonly kind: ImportKind;
    readonly entries: readonly SourceEntry[];
    /** Files of the archive that are not entries (shared files of an export, other files of a text folder). */
    readonly otherFiles: number;
}
/** The part of a CMS instance an import works with. */
export type ImportHost = Pick<Cms, "site" | "store" | "contentService" | "formats" | "isMediaConfigured" | "mediaStore">;
