import { z } from "zod";
import type { ExportSnapshot } from "../core/store/index.js";
import type { Site } from "../site/index.js";
export declare const exportScopeSchema: z.ZodEnum<{
    admin: "admin";
    public: "public";
}>;
export type ExportScope = z.infer<typeof exportScopeSchema>;
/**
 * Public projection schema. It has no `working` field at all and is `.strict()`, so if a draft body or an
 * admin-only key is mixed into the top level of an item, parsing fails (fail-closed).
 * Inside `metadata`, collection fields are too free-form for a recursive allowlist (a non-blocking follow-up).
 */
export declare const publicExportEntrySchema: z.ZodObject<{
    id: z.ZodString;
    collection: z.ZodString;
    slug: z.ZodNullable<z.ZodString>;
    publishedAt: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodString;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    doc: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    contentHash: z.ZodString;
}, z.core.$strict>;
export type PublicExportEntry = z.infer<typeof publicExportEntrySchema>;
/**
 * Public metadata allowlist. Only stored fields of the collection definition are exported, so
 * admin-only keys (storageKey etc.) or values not in the definition mixed into metadata do not go out in the public archive.
 * Per-language names of record collections (`translations`) are not fields and do not go out.
 */
export declare const publicMetadataKeys: (site: PublicSite) => Readonly<Record<string, readonly string[]>>;
export declare function pickPublicMetadata(site: PublicSite, collection: string, metadata: Record<string, unknown>): Record<string, unknown>;
/**
 * Format version of the archive, in the manifest and in the body JSON files. Version 5: an archive can be partial. The manifest says so (`selection`: the
 * entry IDs the export was asked for, or `null` for the whole site), a partial archive holds the whole translation groups of the selection, only the folders
 * (with their ancestors), addresses and media those entries use, and no templates or preferences. A body that could not be written in the chosen format
 * keeps its JSON document and is listed in `notWritten` (empty when every body was written). Version 2 added `working.doc.json` / `published.doc.json` and the
 * `doc` of templates to the admin archive. Version 3: the public archive's `published.json` carries the stored document as `doc` (the same document as
 * `published.doc.json` in the admin archive), next to the MDX text. Version 4: the document is the only body. Text files (`working.<ext>`, `published.<ext>`)
 * and the `body` of a template are written only when the export asked for a `format` (the manifest names it), and the `mdx` of an item and a template is gone.
 * Version 6: the backup holds what a restore needs to put a site back as it was. Each manifest entry also has `trashedAt`, `changedBy` and `changedAt`, and each
 * record of the backup's `media.json` also has `folderId`, `original`, `defaultAlt` and `defaultCaption`. Nothing reads an older version.
 */
export declare const EXPORT_FORMAT_VERSION = 6;
/** The bodies of an export written as text in one format, produced before the archive is built (formats are asynchronous, the archive is not). */
export interface ExportTexts {
    readonly format: {
        readonly name: string;
        readonly extension: string;
    };
    /** The text of each body, by `exportTextKey`. A body that has none (an entry without a published copy) is not in it. */
    readonly bodies: ReadonlyMap<string, string>;
    /** The bodies that could not be written in the format. Their JSON documents are in the archive; only the text file is missing. */
    readonly notWritten: readonly ExportNotWritten[];
}
/** A body whose text could not be written. `reason` is the error code of the failure (it never carries the body or the error's detail). */
export interface ExportNotWritten {
    /** The entry or template ID. */
    id: string;
    state: "working" | "published" | "template";
    reason: string;
}
/** The key of a body in `ExportTexts.bodies`: an entry's `working` or `published` body, or a template. */
export declare const exportTextKey: (id: string, state: "working" | "published" | "template") => string;
export interface ExportManifestEntry {
    id: string;
    collection: string;
    /** Content language and translation group ID. For a source, the group ID is its own ID. */
    locale: string;
    translationGroupId: string;
    status: string;
    version: number;
    workingSlug: string | null;
    publishedSlug: string | null;
    folderId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
    /** Backup only (`null` in a public archive): when the entry went to the trash, and who made the latest change and when. */
    trashedAt: string | null;
    changedBy: string | null;
    changedAt: string | null;
    hasWorking: boolean;
    hasPublished: boolean;
    /** Canonical digest of one state. */
    workingDigest: string | null;
    publishedDigest: string | null;
    /** Digest of the whole item (working copy + published copy). For comparing sameness between archives and for auditing. */
    itemDigest: string;
    files: string[];
}
export interface ExportManifest {
    formatVersion: number;
    scope: ExportScope;
    exportedAt: string;
    digest: string;
    counts: {
        entries: number;
        workingBodies: number;
        publishedBodies: number;
        folders: number;
        media: number;
        templates: number;
        addresses: number;
        preferences: number;
        references: number;
        files: number;
    };
    /** The format the text files of the archive are written in. `null`: the archive holds documents only. */
    format: ExportTexts["format"] | null;
    /** The entries the export was asked for (the archive holds their whole translation groups). `null`: the whole site. */
    selection: {
        ids: string[];
    } | null;
    /** The bodies that were kept as JSON only because the format could not write them. Empty when every body was written. */
    notWritten: ExportNotWritten[];
    entries: ExportManifestEntry[];
    files: string[];
}
export interface ExportArchive {
    zip: Uint8Array;
    manifest: ExportManifest;
    digest: string;
}
/** Canonical JSON that does not depend on key order. Used for digests and snapshot comparison. */
export declare const canonicalJson: (value: unknown) => string;
/** What the public archive needs of a site: the stored fields of its collections. */
type PublicSite = Pick<Site, "COLLECTIONS" | "storedFields">;
export interface BuildExportOptions {
    /** The site the archive is built for (the public archive lists only the fields its collections define). */
    site: PublicSite;
    scope: ExportScope;
    exportedAt: Date;
    /** The bodies as text in a format. Without it the archive holds the documents only. */
    texts?: ExportTexts;
    /** The entries the export was asked for (`ExportPlan.selection`). Only recorded in the manifest. */
    selection?: readonly string[] | null;
    /** File timestamp inside the archive. A fixed value can be used for snapshot tests. */
    archiveModifiedAt?: Date;
}
export declare function buildExportArchive(snapshot: ExportSnapshot, options: BuildExportOptions): ExportArchive;
/** What an export would hold, in counts. It is what the admin shows before the person exports, and what the archive's manifest agrees with. */
export interface ExportSummary {
    scope: ExportScope;
    /** The entries in the archive. */
    entries: number;
    /** How many of them were not asked for but belong to the translation group of one that was. */
    addedByTranslations: number;
    /** Entries of the selection (and their translations) left out because the public archive holds published entries only. Always 0 for a backup. */
    notPublished: number;
    /** Asked-for IDs that match no entry. */
    notFound: number;
    templates: number;
    folders: number;
    addresses: number;
    /** Media records (the files stay in storage and are not part of the archive). */
    media: number;
}
export interface ExportPlan {
    /** The snapshot the archive is built from: the selection, its translation groups, and what they use. */
    snapshot: ExportSnapshot;
    /** The IDs the export was asked for (without repeats), or `null` for the whole site. */
    selection: string[] | null;
    summary: ExportSummary;
}
/**
 * Narrows a snapshot to what an export holds. Without `ids` it is the whole site. With `ids` it is those entries, always expanded to their whole translation
 * groups, with only the folders they sit in (and the folders' ancestors), their addresses, the media their bodies reference, and no templates or
 * preferences. A public archive holds the published members only.
 */
export declare function planExport(snapshot: ExportSnapshot, options: {
    scope: ExportScope;
    ids?: readonly string[] | undefined;
}): ExportPlan;
export {};
