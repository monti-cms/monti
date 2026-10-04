/**
 * Deterministic ZIP writer.
 *
 * Export archives must support snapshot tests, so the same input always produces the same bytes.
 * - Compression uses deflate at fixed level 9 (deterministic with the same zlib).
 * - The caller passes a fixed file time (default 1980-01-01, the ZIP epoch).
 * - The caller sorts and passes the file order.
 */
export interface ZipEntry {
    /** Path inside the ZIP. `/` separator, no leading slash. */
    path: string;
    data: Uint8Array;
}
export declare const crc32: (data: Uint8Array) => number;
export declare function createZipArchive(entries: readonly ZipEntry[], options?: {
    modifiedAt?: Date;
}): Uint8Array;
export interface ZipReadEntry {
    path: string;
    data: Uint8Array;
}
/**
 * Minimal ZIP reader for tests and verification. Reads only the central directory and inflates deflate entries.
 * Not used for anything other than verifying export archives.
 */
export declare function readZipArchive(buffer: Uint8Array): ZipReadEntry[];
