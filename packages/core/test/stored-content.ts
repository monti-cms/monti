import { withoutBlockIds } from "../src/mdx/block-ids";
import { bodyDocument, bodyFromMdx, documentToMdx, readStoredDocument } from "../src/mdx/stored-document";
import type { SyntaxExtension } from "../src/syntax/types";

/**
 * The blocks of a stored document (as read from a store, a `jsonb` column or a parse) without their ids, for comparing what a body says:
 * two reads of the same text draw different ids. `null` when the value is not a stored document.
 */
export const contentOf = (doc: unknown) => {
	const read = readStoredDocument(doc);
	return read ? withoutBlockIds(read.content) : null;
};

/** The stored document of MDX text, as a write stores it (an `unparsed` body when the text cannot be read). */
export const docOf = (mdx: string, syntax?: readonly SyntaxExtension[]) => bodyDocument(bodyFromMdx(mdx, syntax));

/** The MDX a stored document is written as (the `mdx` column). */
export const mdxOf = (doc: Parameters<typeof documentToMdx>[0]) => documentToMdx(doc);
