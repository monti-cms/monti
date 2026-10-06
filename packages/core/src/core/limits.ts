/** Size limits of what a write accepts. Reported by the meta API (`limits`), so a client can check before it sends. */

/** A body given as text, in any format. */
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
/** A stored document given instead of text (JSON spells the same body out at a few times the size). */
export const MAX_DOC_BYTES = 8 * 1024 * 1024;
export const MAX_METADATA_BYTES = 256 * 1024;
