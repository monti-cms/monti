import { type BrowserFormat, useFormat } from "@monti-cms/admin";
import { storedToTiptap, tiptapToStored } from "@monti-cms/admin/editor";
import type { Site } from "@monti-cms/core/client";
import { unparsedDocument } from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";

/**
 * The text a model reads and writes is MDX, so the AI plugin works through the `mdx` format: the editor holds documents, and the format turns them into the
 * text sent to the model and the model's text back into documents. The format is a plugin's (`useFormat`), not something the AI plugin parses with itself.
 */

/** The name of the format the AI plugin talks to the model in. */
export const MDX_FORMAT = "mdx";

/** The `mdx` format as the admin has it registered, or `undefined` when it is not (the AI actions that work on the body cannot run then). */
export const useMdxFormat = (): BrowserFormat | undefined => useFormat(MDX_FORMAT);

/** The text of a piece of the editor's content (blocks as Tiptap JSON), written in the format. */
export const textOfContent = (site: Site, format: BrowserFormat, content: readonly JSONContent[]): string =>
	format.export(tiptapToStored(site, { type: "doc", content: [...content] })).trim();

/** The editor's content for a text the model wrote. A text the format cannot read is kept as it is, in a box, rather than dropped or half read. */
export function contentOfText(site: Site, format: BrowserFormat, text: string): JSONContent[] {
	const read = format.import(text);
	const doc = read.ok ? read.doc : unparsedDocument(text, null, format.name);
	return storedToTiptap(site, doc).content ?? [];
}

/** The document a text reads as, or `null` when the format cannot read it. For showing a preview of what the model wrote. */
export const documentOfText = (format: BrowserFormat, text: string) => {
	const read = format.import(text);
	return read.ok ? read.doc : null;
};
