import { analyze } from "../../mdx/analyze";
import { type StoredDocument, toStoredDocument, unparsedDocument } from "../../mdx/stored-document";
import { toDocument } from "../../mdx/to-document";
import { compareStructure, type StructureCheck, unreadableFailure } from "./skeleton";

/**
 * Translation checks for callers that hold MDX text, such as the AI plugin (its model reads and writes MDX): the text is read into a document and the
 * document checks of `skeleton.ts` run on it. These belong to the MDX format and go with it when it moves to its own package.
 */

const documentOf = (mdx: string): StoredDocument => {
	const stored = toStoredDocument(toDocument(analyze(mdx)));
	return stored ?? unparsedDocument(mdx);
};

/** Whether it can be read as MDX (even with the structure check off, it must be readable to go into the body). */
export function readableMdx(mdx: string): StructureCheck {
	const analysis = analyze(mdx);
	return analysis.errors.length > 0 ? unreadableFailure(analysis.errors[0]?.message) : { ok: true };
}

/** Whether the translated MDX has the same skeleton as the source MDX. Failure if either cannot be read as MDX. */
export function compareMdxStructure(sourceMdx: string, translatedMdx: string): StructureCheck {
	const translated = readableMdx(translatedMdx);
	if (!translated.ok) return translated;
	if (!readableMdx(sourceMdx).ok) return compareStructure(unparsedDocument(sourceMdx), documentOf(translatedMdx));
	return compareStructure(documentOf(sourceMdx), documentOf(translatedMdx));
}
