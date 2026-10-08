import type { Cms } from "../cms/index.js";
import type { Issue } from "../core/types.js";
import type { StoredDocument } from "../doc/stored-document.js";
/** What {@link exportBodyText} writes. */
export interface ExportBodyParams {
    /** The format to write, as `cms.formats()` knows it (for example `mdx`). */
    readonly format: string;
    readonly doc: StoredDocument;
    /** Language of the body. */
    readonly locale: string;
    /**
     * Which entries internal links resolve to. `published` (the default): the published version of the target, and an unpublished target is not a link
     * (a text that is imported again keeps its id). `working`: the target at its current address, drafts included.
     */
    readonly scope?: "published" | "working";
}
/**
 * Writes a stored document as text in a format, the way the admin API and the admin export do (`purpose: "sync"`): the text is written to be imported again, links
 * are the real path of their target (an unresolved link keeps its id) and registered media stay by id. For a plugin that keeps bodies somewhere else (git-sync).
 * An unknown format fails with a `ServiceError` coded `unknown_format`.
 */
export declare function exportBodyText(cms: Cms, params: ExportBodyParams): Promise<{
    readonly text: string;
    readonly warnings: readonly Issue[];
}>;
