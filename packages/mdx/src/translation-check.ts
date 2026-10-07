import { compareStructure, type Site, type StructureCheck, unreadableFailure } from "@monti-cms/core/client";
import { type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import { analyze } from "./analyze";
import { toStoredDocument } from "./body";
import type { SyntaxExtension } from "./syntax/types";
import { toDocument } from "./to-document";

/**
 * Translation checks for callers that hold MDX text, such as the AI plugin (its model reads and writes MDX): the text is read into a document and the
 * document checks of core (`compareStructure`) run on it.
 */

const documentOf = (site: Site, mdx: string, syntax?: readonly SyntaxExtension[]): StoredDocument => {
	const stored = toStoredDocument(site, toDocument(site, analyze(site, mdx, undefined, syntax)));
	return stored ?? unparsedDocument(mdx);
};

/** Whether it can be read as MDX (even with the structure check off, it must be readable to go into the body). */
export function readableMdx(site: Site, mdx: string, syntax?: readonly SyntaxExtension[]): StructureCheck {
	const analysis = analyze(site, mdx, undefined, syntax);
	return analysis.errors.length > 0 ? unreadableFailure(site, analysis.errors[0]?.message) : { ok: true };
}

/** Whether the translated MDX has the same skeleton as the source MDX. Failure if either cannot be read as MDX. */
export function compareMdxStructure(
	site: Site,
	sourceMdx: string,
	translatedMdx: string,
	syntax?: readonly SyntaxExtension[],
): StructureCheck {
	const translated = readableMdx(site, translatedMdx, syntax);
	if (!translated.ok) return translated;
	if (!readableMdx(site, sourceMdx, syntax).ok) {
		return compareStructure(site, unparsedDocument(sourceMdx), documentOf(site, translatedMdx, syntax));
	}
	return compareStructure(site, documentOf(site, sourceMdx, syntax), documentOf(site, translatedMdx, syntax));
}
