import type { SyntaxExtension } from "../syntax/types";
import { bodyText, EXCERPT_TEXT } from "./body-text";

/**
 * Readable plain text of an MDX body. Used for filling fields from the body (`fillFromBody`).
 * It is taken from the parsed body, so it works for any notation the site reads (`mdx.syntax`): the text of paragraphs, headings, list items, table cells and the bodies of
 * blocks, and the text attributes of blocks (a callout title). Code, math, images and the text a reader does not see are left out.
 */
export function toPlainText(mdx: string, syntax?: readonly SyntaxExtension[]): string {
	return bodyText(mdx, EXCERPT_TEXT, syntax);
}

/**
 * Leading plain text of the body (up to `maxLength` characters, with `…` appended if longer). Used when filling an empty field from the body (`fillFromBody`).
 * Empty string if there is no text to produce.
 */
export function bodyExcerpt(mdx: string, maxLength = 160, syntax?: readonly SyntaxExtension[]): string {
	const text = toPlainText(mdx, syntax);
	const chars = Array.from(text);
	if (chars.length <= maxLength) return text;
	return `${chars
		.slice(0, maxLength - 1)
		.join("")
		.trimEnd()}…`;
}
