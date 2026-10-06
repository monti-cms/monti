import { docOfText } from "../src/doc/__test__/doc-text";
import { readStoredDocument, withoutBlockIds } from "../src/document";

/**
 * The blocks of a stored document (as read from a store, a `jsonb` column or a parse) without their ids, for comparing what a body says:
 * two reads of the same text draw different ids. `null` when the value is not a stored document.
 */
export const contentOf = (doc: unknown) => {
	const read = readStoredDocument(doc);
	return read ? withoutBlockIds(read.content) : null;
};

/**
 * The stored document of plain text (see `doc-text.ts` for what it reads), as a write stores it. Core parses no text format, so a test that needs a node the
 * reader does not know builds the document by hand.
 */
export const docOf = docOfText;
