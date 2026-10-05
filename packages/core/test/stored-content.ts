import { withoutBlockIds } from "../src/mdx/block-ids";
import { readStoredDocument } from "../src/mdx/stored-document";

/**
 * The blocks of a stored document (as read from a store, a `jsonb` column or a parse) without their ids, for comparing what a body says:
 * two reads of the same text draw different ids. `null` when the value is not a stored document.
 */
export const contentOf = (doc: unknown) => {
	const read = readStoredDocument(doc);
	return read ? withoutBlockIds(read.content) : null;
};
