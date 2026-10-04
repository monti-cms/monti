import { analyze } from "./analyze.js";
import { serialize } from "./serialize.js";
import { toDocument } from "./to-document.js";
export const SourceConverter = {
    toVisual(source, name) {
        const analysis = analyze(source, name);
        if (analysis.errors.length > 0) {
            return { type: "error", source, errors: analysis.errors };
        }
        const document = toDocument(analysis);
        return { type: "visual", document, originalSource: source };
    },
    toSource(state, hasDocumentChanged) {
        if (!hasDocumentChanged) {
            return state.originalSource;
        }
        return serialize(state.document);
    },
};
