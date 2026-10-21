/**
 * Imports entries from an uploaded zip into this site as new entries, through the normal write pipeline (admin only). The zip is an export of this
 * version, or a zip of `.md` / `.mdx` files with front matter. It brings in the title, slug and body of document collections; nothing else is read, and the answer
 * says what was left out. The upload is at most `limits.importBytes` of `/v1/meta` (413 above it).
 *
 * `multipart/form-data` fields:
 * - `file`: the zip.
 * - `mode`: `preview` (writes nothing, answers what would happen) or `run`.
 * - `mapping`: JSON, archive collection → document collection of this site, or `null` to skip it. A collection that is not listed goes to the collection of the same name.
 * - `publish`: `true` (with `run`) publishes the entries that were published in the archive once every body is saved.
 */
export declare const POST: import("../../handler.js").AdminHandler<{
    [x: string]: string;
}>;
