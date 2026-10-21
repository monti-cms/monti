import { MAX_IMPORT_BYTES } from "../../../core/limits.js";
import { importNotice } from "../../../services/entry-import/notice.js";
import { CmsError, readFormBody } from "../handler.js";
/** The envelope of a multipart upload around the file: boundaries, field names and the small fields. */
const FORM_ENVELOPE_BYTES = 256 * 1024;
/**
 * Reads the multipart body of an import route: the `file` (a zip of at most {@link MAX_IMPORT_BYTES}, 413 above it) and the `mode` field (`preview` or `run`).
 * The other fields are in `form`.
 */
export async function readImportUpload(request) {
    const form = await readFormBody(request, MAX_IMPORT_BYTES + FORM_ENVELOPE_BYTES);
    const file = form.get("file");
    if (typeof file === "string" || file === null)
        throw importNotice("import.upload.missing");
    if (file.size > MAX_IMPORT_BYTES) {
        throw new CmsError(`The file exceeds ${MAX_IMPORT_BYTES} bytes`, "payload_too_large");
    }
    const mode = form.get("mode");
    if (mode !== "preview" && mode !== "run")
        throw new CmsError("mode must be preview or run", "invalid_input");
    return { form, bytes: new Uint8Array(await file.arrayBuffer()), mode };
}
