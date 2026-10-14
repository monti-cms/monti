import type { Cms } from "../cms/index.js";
import type { StoredDocument } from "../doc/stored-document.js";
type Source = "working" | "published";
/**
 * Writes stored documents as text in one format, for the admin API (`?format=`, the export archive). One place decides how:
 * - `purpose: "sync"` writes text to be imported again: links by path, an unresolved link keeps its id, media by id (the admin reads, templates and the admin archive);
 * - `purpose: "read"` writes what a reader sees: an unpublished target is not a link, images by public URL (the public archive).
 * `source` says which version of the entries the links are resolved against.
 */
export interface BodyExporter {
    readonly format: {
        readonly name: string;
        readonly extension: string;
    };
    /** The document as text in the format. */
    text(doc: StoredDocument, locale: string): Promise<string>;
}
export declare function createBodyExporter(cms: Pick<Cms, "site" | "formats" | "store" | "mediaStore">, options: {
    readonly format: string;
    readonly purpose?: "sync" | "read";
    readonly source?: Source;
}): Promise<BodyExporter>;
export {};
