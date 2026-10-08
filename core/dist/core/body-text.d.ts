import type { StoredDocument } from "../doc/stored-document.js";
import type { Site } from "../site/index.js";
/**
 * Readable text of a stored document. The document says what is text and what is a block, so a block is understood from its definition (its
 * `translatable` attributes are the text a reader sees), without a pattern per notation.
 */
export interface BodyTextOptions {
    /** Code (code blocks and inline code) and math. */
    readonly code: boolean;
    /** Images (alt text, caption, title) and file cards (label). */
    readonly media: boolean;
    /** Text a reader of the page does not see: translation notes and the hover text of a text decoration (a tooltip). */
    readonly hidden: boolean;
}
/** What the page shows as prose, for a summary (`fillFromBody`). */
export declare const EXCERPT_TEXT: BodyTextOptions;
/** Everything a person could look for in the body, for search. */
export declare const SEARCH_TEXT: BodyTextOptions;
/**
 * The text of a document, as one line (runs of whitespace are one space). Block elements are set apart by a space and inline
 * runs stay together, so a word split by emphasis is still one word.
 */
export declare function documentText(site: Site, doc: StoredDocument, options: BodyTextOptions): string;
