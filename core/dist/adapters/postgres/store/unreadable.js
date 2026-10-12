/** Helpers for the steps that keep a body they cannot read exactly as it was (see `UnreadableBody`). */
/** Whether a text has a `:::name` block, the notation of the directive syntax. */
export const hasDirectiveBlock = (text) => /^[ \t]*:{3,}[A-Za-z]/m.test(text ?? "");
/** The kind of a stored body from its state (`working` is the draft). */
export const kindOfState = (state) => (state === "published" ? "published" : "draft");
