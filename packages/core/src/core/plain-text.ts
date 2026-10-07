import type { StoredDocument } from "../doc/stored-document";
import type { Site } from "../site";
import { documentText, EXCERPT_TEXT } from "./body-text";

/**
 * Readable plain text of a stored document. Used for filling fields from the body (`fillFromBody`).
 * It is taken from the document, so it works for any notation the body was written in: the text of paragraphs, headings, list items, table cells and the bodies of
 * blocks, and the text attributes of blocks (a callout title). Code, math, images and the text a reader does not see are left out.
 */
export function toPlainText(site: Site, doc: StoredDocument): string {
	return documentText(site, doc, EXCERPT_TEXT);
}

/**
 * Leading plain text of the body (up to `maxLength` characters, with `…` appended if longer). Used when filling an empty field from the body (`fillFromBody`).
 * Empty string if there is no text to produce.
 */
export function bodyExcerpt(site: Site, doc: StoredDocument, maxLength = 160): string {
	const text = toPlainText(site, doc);
	const chars = Array.from(text);
	if (chars.length <= maxLength) return text;
	return `${chars
		.slice(0, maxLength - 1)
		.join("")
		.trimEnd()}…`;
}
