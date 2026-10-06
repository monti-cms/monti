import { storedToTiptap, tiptapToStored } from "@monti-cms/admin/editor";
import { assignBlockIds, type StoredDocument } from "@monti-cms/core/document";
import { mdxBrowserFormat } from "@monti-cms/mdx/admin";
import type { JSONContent } from "@tiptap/core";

/**
 * Test helpers: a fixture written as MDX text and the editor's content, both ways. The editor works on stored documents and knows no notation; these tests
 * describe their bodies as MDX because it is the shortest way, and read it through the built-in `mdx` format.
 */

/** The stored document a fixture reads as, with block ids as a body loaded from the server has them. */
export const docOfMdx = (mdx: string): StoredDocument => {
	const read = mdxBrowserFormat.import(mdx);
	if (!read.ok)
		throw new Error(
			`not readable: ${read.issues.map((issue: { message?: string; code: string }) => issue.message ?? issue.code).join(", ")}`,
		);
	return { ...read.doc, content: assignBlockIds(read.doc.content) };
};

/** The editor's JSON for a fixture. */
export const mdxToTiptap = (mdx: string): JSONContent => storedToTiptap(docOfMdx(mdx));

/** The text the editor's content is written as. */
export const tiptapToMdx = (content: JSONContent): string => mdxBrowserFormat.export(tiptapToStored(content));
