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
    schemaVersion: z.ZodNumber;
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
 * Format version of the archive, in the manifest and in the body JSON files. Version 2 added `working.doc.json` / `published.doc.json` and the
 * `doc` of templates to the admin archive. Version 3: the public archive's `published.json` carries the stored document as `doc` (the same document as
 * `published.doc.json` in the admin archive), next to the MDX text. Version 4: the document is the only body. Text files (`working.<ext>`, `published.<ext>`)
 * and the `body` of a template are written only when the export asked for a `format` (the manifest names it), and the `mdx` of an item and a template is gone.
 */
export declare const EXPORT_FORMAT_VERSION = 4;
/** The bodies of an export written as text in one format, produced before the archive is built (formats are asynchronous, the archive is not). */
export interface ExportTexts {
    readonly format: {
        readonly name: string;
        readonly extension: string;
    };
    /** The text of each body, by `exportTextKey`. A body that has none (an entry without a published copy) is not in it. */
    readonly bodies: ReadonlyMap<string, string>;
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
    /** File timestamp inside the archive. A fixed value can be used for snapshot tests. */
    archiveModifiedAt?: Date;
}
export declare function buildExportArchive(snapshot: ExportSnapshot, options: BuildExportOptions): ExportArchive;
export {};
