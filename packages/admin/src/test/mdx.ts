import { assignBlockIds, type StoredDocument } from "@monti-cms/core/document";
import { mdxBrowserFormat } from "@monti-cms/mdx/admin";
import type { JSONContent } from "@tiptap/core";
import { storedToTiptap, tiptapToStored } from "../editor/tiptap-content";

/**
 * Test helpers: write a fixture as MDX text (the MDX package's browser format) and get the stored document the editor works on, or the other way round. The editor itself
 * knows no notation; tests use MDX because it is the shortest way to describe a body.
 */

/** The stored document a fixture reads as. Blocks get block ids as they do on the way in from a text. Fails for text the format cannot read. */
export const docOf = (mdx: string, previous?: StoredDocument | null): StoredDocument => {
	const read = mdxBrowserFormat.import(mdx);
	if (!read.ok)
		throw new Error(
			`not readable: ${read.issues.map((issue: { message?: string; code: string }) => issue.message ?? issue.code).join(", ")}`,
		);
	return { ...read.doc, content: assignBlockIds(read.doc.content, [previous?.content]) };
};

/** The editor's JSON for a fixture. */
export const tiptapOf = (mdx: string, previous?: StoredDocument | null): JSONContent =>
	storedToTiptap(docOf(mdx, previous));

/** The text the document of the editor's JSON is written as. */
export const mdxOfTiptap = (json: JSONContent): string => mdxBrowserFormat.export(tiptapToStored(json));

/** The text of a document. */
export const mdxOfDoc = (doc: StoredDocument): string => mdxBrowserFormat.export(doc);
