import { z } from "zod";
import type { ExportSnapshot } from "../adapters/postgres/content-store.js";
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
    mdx: z.ZodString;
    schemaVersion: z.ZodNumber;
    contentHash: z.ZodString;
}, z.core.$strict>;
export type PublicExportEntry = z.infer<typeof publicExportEntrySchema>;
/**
 * Public metadata allowlist. Only stored fields of the collection definition are exported, so
 * admin-only keys (storageKey etc.) or values not in the definition mixed into metadata do not go out in the public archive.
 * Per-language names of record collections (`translations`) are not fields and do not go out.
 */
export declare const PUBLIC_METADATA_KEYS: Readonly<Record<string, readonly string[]>>;
export declare function pickPublicMetadata(collection: string, metadata: Record<string, unknown>): Record<string, unknown>;
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
export interface BuildExportOptions {
    scope: ExportScope;
    exportedAt: Date;
    /** File timestamp inside the archive. A fixed value can be used for snapshot tests. */
    archiveModifiedAt?: Date;
}
export declare function buildExportArchive(snapshot: ExportSnapshot, options: BuildExportOptions): ExportArchive;
