/** Size limits of what a write accepts. Reported by the meta API (`limits`), so a client can check before it sends. */
/** A body given as text, in any format. */
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
/** A stored document given instead of text (JSON spells the same body out at a few times the size). */
export const MAX_DOC_BYTES = 8 * 1024 * 1024;
export const MAX_METADATA_BYTES = 256 * 1024;
/**
 * The most bytes the HTTP boundary reads from one request body, whatever the route. It is checked before the body is parsed, so an oversized request
 * costs a counter and not memory. It sits above every legitimate admin body: an entry body of `MAX_DOC_BYTES` spelled out as JSON (escaping can
 * multiply text a few times, so 4x), plus `MAX_METADATA_BYTES`, plus room for the rest of the envelope. Bulk requests (up to 100 items) and schema saves
 * stay well under it. The per-field limits above still apply after parsing; this cap only bounds what is read at all.
 */
export const MAX_REQUEST_BYTES = 4 * MAX_DOC_BYTES + MAX_METADATA_BYTES + 1024 * 1024;
/** Login form posts hold an email and a password. Public routes read them before anyone is signed in, so this is far lower than `MAX_REQUEST_BYTES`. */
export const MAX_FORM_BYTES = 64 * 1024;
/**
 * The largest zip an entry import takes (`POST /v1/import/entries`), in bytes. A larger upload is refused with 413 before it is read. What the archive inflates to
 * is bounded as well (`MAX_IMPORT_INFLATED_BYTES`), so a small zip cannot expand without limit.
 */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
