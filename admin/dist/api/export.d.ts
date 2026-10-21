import { type Site } from "@monti-cms/core/site";
export type ExportScope = "admin" | "public";
/** What an export is asked for: the scope, the entries (none: the whole site) and the text format to also write the bodies in (none: JSON documents only). */
export interface ExportRequest {
    scope: ExportScope;
    ids?: readonly string[];
    format?: string;
}
/** What `GET /v1/export/summary` says an archive would hold. */
export interface ExportSummary {
    scope: ExportScope;
    entries: number;
    /** Entries that were not asked for but belong to the translation group of one that was. */
    addedByTranslations: number;
    /** Entries a public export leaves out because they are not published. */
    notPublished: number;
    /** Asked-for ids that match no entry. */
    notFound: number;
    templates: number;
    folders: number;
    addresses: number;
    /** Media records. The files stay in storage and are not part of the archive. */
    media: number;
}
/** A text format the server can write bodies in (the meta route's `formats`). */
export interface ExportFormat {
    name: string;
    label: string;
    extension: string;
}
/** Query keys. */
export declare const exportKeys: {
    all: readonly ["cms", "export"];
    formats: () => readonly ["cms", "export", "formats"];
    summary: (request: Pick<ExportRequest, "scope" | "ids">) => readonly ["cms", "export", "summary", ExportScope, string | null];
};
/** The text formats installed on the server. */
export declare const listExportFormats: (site: Site, signal?: AbortSignal, fallback?: string) => Promise<ExportFormat[]>;
/** What an export of `request` would hold. Nothing is built. (A `POST`, so a long list of ids fits.) */
export declare const getExportSummary: (site: Site, request: Pick<ExportRequest, "scope" | "ids">, signal?: AbortSignal, fallback?: string) => Promise<ExportSummary>;
/** The archive of an export, read in full. */
export interface ExportDownload {
    blob: Blob;
    filename: string;
    /** How many bodies are in the archive as JSON only because the format could not write them. */
    notWritten: number;
}
/** How far a download is: `total` is `null` when the server did not say how large the archive is. */
export interface ExportProgress {
    received: number;
    total: number | null;
}
/**
 * Builds the archive of `request` on the server and reads it, reporting how far the download is. A failure is thrown as
 * {@link CmsApiError}, in the admin language of `site`. (A `POST`, so a long list of ids fits.)
 */
export declare function downloadExport(site: Site, request: ExportRequest, options?: {
    signal?: AbortSignal;
    onProgress?: (progress: ExportProgress) => void;
    fallback?: string;
}): Promise<ExportDownload>;
/** Hands a file to the browser as a download. */
export declare function saveBlob(blob: Blob, filename: string): void;
