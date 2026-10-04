import { SourceConverter } from "@monti-cms/core/mdx";
export class EditorToggle {
    currentMode;
    sourceText;
    visualDocument;
    parseErrors;
    documentChanged;
    constructor(initialSource) {
        this.sourceText = initialSource;
        this.currentMode = "source";
        this.visualDocument = null;
        this.parseErrors = [];
        this.documentChanged = false;
        this.openVisual(initialSource);
    }
    get mode() {
        return this.currentMode;
    }
    get source() {
        return this.sourceText;
    }
    get document() {
        return this.visualDocument ? structuredClone(this.visualDocument) : null;
    }
    get errors() {
        return structuredClone(this.parseErrors);
    }
    openVisual(source, name) {
        const result = SourceConverter.toVisual(source, name);
        if (result.type === "error") {
            this.currentMode = "source";
            this.sourceText = source;
            this.visualDocument = null;
            this.parseErrors = structuredClone(result.errors);
            this.documentChanged = false;
        }
        else {
            this.currentMode = "visual";
            this.sourceText = result.originalSource;
            this.visualDocument = result.document;
            this.parseErrors = [];
            this.documentChanged = false;
        }
    }
    notifyVisualChange(newDocument) {
        if (this.currentMode !== "visual")
            return;
        this.visualDocument = structuredClone(newDocument);
        this.documentChanged = true;
    }
    toggleToSource() {
        if (this.currentMode === "source")
            return;
        if (this.visualDocument) {
            this.sourceText = SourceConverter.toSource({
                originalSource: this.sourceText,
                document: this.visualDocument,
            }, this.documentChanged);
        }
        this.currentMode = "source";
    }
    toggleToVisual() {
        if (this.currentMode === "visual")
            return;
        this.openVisual(this.sourceText);
    }
    updateSource(newSource) {
        if (this.currentMode !== "source")
            return;
        this.sourceText = newSource;
    }
}
