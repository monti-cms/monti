/** Helpers for the steps that keep a body they cannot read exactly as it was (see `UnreadableBody`). */
/** Whether a text has a `:::name` block, the notation of the directive syntax. */
export declare const hasDirectiveBlock: (text: string | null | undefined) => boolean;
/** The kind of a stored body from its state (`working` is the draft). */
export declare const kindOfState: (state: string) => "published" | "draft";
