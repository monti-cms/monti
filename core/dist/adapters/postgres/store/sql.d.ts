/** "Contains this text" pattern. Always pass the value as a bind parameter. */
export declare const likeContainsPattern: (value: string) => string;
/** "Has a word that starts with this text" pattern (a space before it). Always pass the value as a bind parameter. */
export declare const likeWordPattern: (value: string) => string;
/** "Starts with this text" pattern. Always pass the value as a bind parameter. */
export declare const likePrefixPattern: (value: string) => string;
