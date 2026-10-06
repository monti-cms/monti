import { compareStructure, type StructureCheck, unreadableFailure } from "@monti-cms/core/client";
import { type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import { analyze } from "./analyze";
import { toStoredDocument } from "./body";
import type { SyntaxExtension } from "./syntax/types";
import { toDocument } from "./to-document";

/**
 * Translation checks for callers that hold MDX text, such as the AI plugin (its model reads and writes MDX): the text is read into a document and the
 * document checks of core (`compareStructure`) run on it.
 */

const documentOf = (mdx: string, syntax?: readonly SyntaxExtension[]): StoredDocument => {
	const stored = toStoredDocument(toDocument(analyze(mdx, undefined, syntax)));
	return stored ?? unparsedDocument(mdx);
};

/** Whether it can be read as MDX (even with the structure check off, it must be readable to go into the body). */
export function readableMdx(mdx: string, syntax?: readonly SyntaxExtension[]): StructureCheck {
	const analysis = analyze(mdx, undefined, syntax);
	return analysis.errors.length > 0 ? unreadableFailure(analysis.errors[0]?.message) : { ok: true };
}

/** Whether the translated MDX has the same skeleton as the source MDX. Failure if either cannot be read as MDX. */
export function compareMdxStructure(
	sourceMdx: string,
	translatedMdx: string,
	syntax?: readonly SyntaxExtension[],
): StructureCheck {
	const translated = readableMdx(translatedMdx, syntax);
	if (!translated.ok) return translated;
	if (!readableMdx(sourceMdx, syntax).ok) {
		return compareStructure(unparsedDocument(sourceMdx), documentOf(translatedMdx, syntax));
	}
	return compareStructure(documentOf(sourceMdx, syntax), documentOf(translatedMdx, syntax));
}
