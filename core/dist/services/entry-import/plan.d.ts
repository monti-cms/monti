import type { StoredDocument } from "../../doc/stored-document.js";
import type { Issue } from "../types.js";
import type { ImportHost, ImportReason, ImportSource, SourceEntry } from "./types.js";
/** An archive collection and where its entries go. */
export interface PlannedCollection {
    /** The folder name in the archive (empty for text files at the top of the archive). */
    readonly name: string;
    readonly entries: number;
    /** The document collection the entries go to, or `null` when they are skipped. */
    readonly target: string | null;
    /** Why the collection is skipped, when it is. */
    readonly skipped: ImportReason | null;
}
/** A value the archive holds that the import does not read, per collection. */
export interface FieldsNotImported {
    readonly collection: string;
    readonly target: string;
    readonly fields: readonly string[];
    /** Required fields of the target that the import does not fill: an entry needs them before it can be published. */
    readonly required: readonly string[];
}
export interface PlannedEntry {
    readonly source: SourceEntry;
    /** The target collection, `null` when skipped before one was chosen. */
    readonly target: string | null;
    readonly title: string | null;
    readonly slug: string | null;
    /** Why the entry is not imported. `null`: it will be. */
    readonly skip: ImportReason | null;
    /** Findings about an entry that is imported. */
    readonly notes: readonly ImportReason[];
    /** The body as a document, read once for the preview and the run. `null` for a skipped entry. */
    readonly doc: StoredDocument | null;
    /** What reading the text said, which the saved draft will carry as warnings too. */
    readonly readIssues: readonly Issue[];
    /** How many images of the body point outside this site's media. */
    readonly outsideImages: number;
    /** How many links by id point to an entry that is not imported. */
    readonly keptLinks: number;
    /** The metadata key the title was read from; it is not a field that goes unread. */
    readonly titleKey: string | null;
}
export interface ImportPlan {
    readonly kind: ImportSource["kind"];
    readonly collections: readonly PlannedCollection[];
    /** The document collections of the site an archive collection can go to. */
    readonly targets: readonly {
        name: string;
        label: string;
    }[];
    readonly entries: readonly PlannedEntry[];
    readonly fieldsNotImported: readonly FieldsNotImported[];
    readonly otherFiles: number;
}
/** The archive collection → document collection choices of a request. A name that is not a document collection of this site is refused. */
export type ImportMapping = Readonly<Record<string, string | null>>;
/**
 * Decides, for every entry of an archive, whether it is imported and where it goes. Nothing is written. An entry is skipped, each with its reason, when
 * its collection has no target (an item collection, a name this site lacks, or the person's choice), its language is not one of the site's, it has no body
 * or title, its slug is taken (in the site, or by another entry of the archive), or it is a translation whose source is not imported.
 */
export declare function planImport(host: ImportHost, source: ImportSource, mapping?: ImportMapping): Promise<ImportPlan>;
