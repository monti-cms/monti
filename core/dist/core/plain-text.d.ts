import type { StoredDocument } from "../doc/stored-document.js";
import type { Site } from "../site/index.js";
/**
 * Readable plain text of a stored document. Used for filling fields from the body (`fillFromBody`).
 * It is taken from the document, so it works for any notation the body was written in: the text of paragraphs, headings, list items, table cells and the bodies of
 * blocks, and the text attributes of blocks (a callout title). Code, math, images and the text a reader does not see are left out.
 */
export declare function toPlainText(site: Site, doc: StoredDocument): string;
/**
 * Leading plain text of the body (up to `maxLength` characters, with `…` appended if longer). Used when filling an empty field from the body (`fillFromBody`).
 * Empty string if there is no text to produce.
 */
export declare function bodyExcerpt(site: Site, doc: StoredDocument, maxLength?: number): string;
