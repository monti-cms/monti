import { type Issue } from "../core/types.js";
import { type StoredDocument } from "../doc/stored-document.js";
import type { Site } from "../site/index.js";
import type { FormatRegistry } from "./registry.js";
import type { FormatLink, FormatMedia, FormatPurpose } from "./types.js";
/** A text that was read into a document: the document, and what was found about the text. */
export interface ImportedText {
    readonly doc: StoredDocument;
    /** Why the text could not be read: it is kept as an `unparsed` node of the document, which a draft can hold and `unparsed_body` blocks publishing. */
    readonly issues: Issue[];
    /** Things the document does not keep as written. */
    readonly warnings: Issue[];
}
export interface ImportOptions {
    readonly locale: string;
    /** The entry the text is written to, when it exists. */
    readonly entryId?: string;
    /** The body the text replaces. The blocks of the result inherit its block ids where they pair up. */
    readonly previous?: StoredDocument | null;
    /**
     * What to do with a text the format rejects. By default it is kept as an `unparsed` document (a draft can hold it). With `strict` it fails the write with
     * `format_import_failed` and the format's findings as `issues`, for a place that cannot hold such a text.
     */
    readonly strict?: boolean;
}
/**
 * Reads a text in a format into a document. The format returns the document without caring about ids; here every block gets one (inheriting from
 * `previous`). A text the format rejects (`ok: false`) is not lost: it becomes the document of one `unparsed` node holding the text as given, with the
 * format's findings as `issues`. A format that is unknown or one-way, or that throws, fails the write.
 */
export declare function importText(site: Site, registry: FormatRegistry, name: string, text: string, options: ImportOptions): Promise<ImportedText>;
/** What the document points to, resolved before a format writes it (so the format's lookups are synchronous). */
export interface ExportRefs {
    /** Entry id (translation group id) → where the link goes. An id that is not here is unresolved. */
    readonly links: ReadonlyMap<string, FormatLink> | Readonly<Record<string, FormatLink | undefined>>;
    /** Media id → the public URL and file info. An id that is not here is unresolved. */
    readonly media: ReadonlyMap<string, FormatMedia> | Readonly<Record<string, FormatMedia | undefined>>;
}
export interface ExportOptions {
    readonly locale: string;
    readonly purpose: FormatPurpose;
    readonly refs: ExportRefs;
}
/** Writes a document as text in a format. The warnings are what the format reported (an unresolved link or media). */
export declare function exportText(site: Site, registry: FormatRegistry, name: string, doc: StoredDocument, options: ExportOptions): Promise<{
    text: string;
    warnings: Issue[];
}>;
