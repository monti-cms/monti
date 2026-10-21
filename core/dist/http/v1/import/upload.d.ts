export interface ImportUpload {
    readonly form: FormData;
    /** The bytes of the zip. */
    readonly bytes: Uint8Array;
    readonly mode: "preview" | "run";
}
/**
 * Reads the multipart body of an import route: the `file` (a zip of at most {@link MAX_IMPORT_BYTES}, 413 above it) and the `mode` field (`preview` or `run`).
 * The other fields are in `form`.
 */
export declare function readImportUpload(request: Request): Promise<ImportUpload>;
