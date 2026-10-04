/** Escapes `%`, `_`, and `\` so they match literally inside a `LIKE` pattern (`\` is Postgres's default escape character). */
const escapeLikeText = (value: string): string => value.replace(/[%_\\]/g, "\\$&");

/** "Contains this text" pattern. Always pass the value as a bind parameter. */
export const likeContainsPattern = (value: string): string => `%${escapeLikeText(value)}%`;

/** "Starts with this text" pattern. Always pass the value as a bind parameter. */
export const likePrefixPattern = (value: string): string => `${escapeLikeText(value)}%`;
