/**
 * Readable plain text of an MDX body. Used for filling fields from the body (`fillFromBody`).
 * Code, math, images and directive syntax are dropped; only the labels of links and directives remain.
 */
export declare function toPlainText(mdx: string): string;
/**
 * Leading plain text of the body (up to `maxLength` characters, with `…` appended if longer). Used when filling an empty field from the body (`fillFromBody`).
 * Empty string if there is no text to produce.
 */
export declare function bodyExcerpt(mdx: string, maxLength?: number): string;
