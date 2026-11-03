import type { StoredDocument } from "@monti-cms/core/document";
import { docOfText } from "./doc-text";

/**
 * Story helpers: describe a body as plain text and get the stored document the editor works on. The admin knows no text notation and does not depend on the MDX
 * package, so `docOfText` (`doc-text.ts`) reads a small CommonMark subset (paragraphs, headings, lists, quotes, fenced code, images, links, bold, italic, strike,
 * code, `<br />`). Anything else is built by hand (`stored-doc.ts`).
 */

/** The stored document a fixture reads as, with block ids paired with those of `previous`. */
export const docOf = (text: string, previous?: StoredDocument | null): StoredDocument => docOfText(text, previous);
