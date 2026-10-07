import type { StoredDocument } from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
import { testSite } from "../../../core/test/site";
import { storedToTiptap } from "../editor/tiptap-content";
import { docOfText } from "./doc-text";

/**
 * Test helpers: describe a body as plain text and get the stored document the editor works on. The admin knows no text notation and does not depend on the MDX
 * package, so `docOfText` (`doc-text.ts`) reads a small CommonMark subset (paragraphs, headings, lists, quotes, fenced code, images, links, bold, italic, strike,
 * code, `<br />`). A test that needs anything else (a block with attributes, a table, a footnote) builds the document by hand, or, when its point is the round trip
 * between MDX text and the editor, lives in `packages/mdx`.
 */

/** The stored document a fixture reads as, with block ids paired with those of `previous`. */
export const docOf = (text: string, previous?: StoredDocument | null): StoredDocument => docOfText(text, previous);

/** The editor's JSON for a fixture. */
export const tiptapOf = (text: string, previous?: StoredDocument | null): JSONContent =>
	storedToTiptap(testSite, docOf(text, previous));
