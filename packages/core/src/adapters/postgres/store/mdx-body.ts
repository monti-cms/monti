import { documentText, SEARCH_TEXT } from "../../../core/body-text";
import { computeContentHash } from "../../../core/content-hash";
import type { JsonValue } from "../../../core/types";
import { analyze } from "../../../mdx/analyze";
import { type StoredDocument, toStoredDocument, unparsedDocument } from "../../../mdx/stored-document";
import { toDocument } from "../../../mdx/to-document";
import type { SyntaxExtension } from "../../../syntax/types";

/**
 * Hash and search text of a body given as MDX text, for the store migrations that predate stored documents (0010 to 0015): they work from the text
 * a row holds. The document of the text is its parsed stored document, whether or not the text reads back the same once written; text that does not
 * parse, or has front matter, is hashed as it is (the same rules `computeContentHash` always had). New code works from documents and never calls these.
 */
const parsedDocument = (mdx: string, syntax?: readonly SyntaxExtension[]): StoredDocument => {
	const analysis = analyze(mdx, undefined, syntax);
	if (analysis.errors.length === 0) {
		try {
			const stored = toStoredDocument(toDocument(analysis));
			if (stored) return stored;
		} catch {
			// Not a document: hashed as text below.
		}
	}
	return unparsedDocument(mdx);
};

export const mdxContentHash = (
	metadata: JsonValue,
	mdx: string,
	schemaVersion = 1,
	syntax?: readonly SyntaxExtension[],
): string => computeContentHash(metadata, parsedDocument(mdx, syntax), schemaVersion);

export const mdxSearchText = (mdx: string, syntax?: readonly SyntaxExtension[]): string =>
	documentText(parsedDocument(mdx, syntax), SEARCH_TEXT);
