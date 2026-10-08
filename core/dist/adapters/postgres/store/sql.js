/** Escapes `%`, `_`, and `\` so they match literally inside a `LIKE` pattern (`\` is Postgres's default escape character). */
const escapeLikeText = (value) => value.replace(/[%_\\]/g, "\\$&");
/** "Contains this text" pattern. Always pass the value as a bind parameter. */
export const likeContainsPattern = (value) => `%${escapeLikeText(value)}%`;
/** "Has a word that starts with this text" pattern (a space before it). Always pass the value as a bind parameter. */
export const likeWordPattern = (value) => `% ${escapeLikeText(value)}%`;
/** "Starts with this text" pattern. Always pass the value as a bind parameter. */
export const likePrefixPattern = (value) => `${escapeLikeText(value)}%`;
