import { analyze } from "./analyze";
import { serialize } from "./serialize";
import { toDocument } from "./to-document";
import type { CmsMdxError, CmsNode } from "./types";

export type SourceConversionResult =
	| { type: "visual"; document: CmsNode; originalSource: string }
	| { type: "error"; source: string; errors: CmsMdxError[] };

export const SourceConverter = {
	toVisual(source: string, name?: string): SourceConversionResult {
		const analysis = analyze(source, name);
		if (analysis.errors.length > 0) {
			return { type: "error", source, errors: analysis.errors };
		}
		const document = toDocument(analysis);
		return { type: "visual", document, originalSource: source };
	},

	toSource(state: { originalSource: string; document: CmsNode }, hasDocumentChanged: boolean): string {
		if (!hasDocumentChanged) {
			return state.originalSource;
		}
		return serialize(state.document);
	},
};
