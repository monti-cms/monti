/** Size limits of what a write accepts. Reported by the meta API (`limits`), so a client can check before it sends. */
/** A body given as text, in any format. */
export declare const MAX_TEXT_BYTES: number;
/** A stored document given instead of text (JSON spells the same body out at a few times the size). */
export declare const MAX_DOC_BYTES: number;
export declare const MAX_METADATA_BYTES: number;
