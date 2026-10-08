import type { BrowserFormat } from "@monti-cms/admin";
import type { StoredDocument } from "@monti-cms/core/document";
import type { FormatIssue } from "@monti-cms/core/format";
export type EditorMode = "visual" | "source";
/**
 * The state of switching a body between the visual editor and its source text. The document is the source of truth; the text is what a format writes of it.
 * Opening a text that does not read keeps it as it is and stays in source mode; switching to source without having edited visually gives back the exact
 * text that was opened.
 */
export declare class EditorToggle {
    private readonly format;
    private currentMode;
    private sourceText;
    private visualDocument;
    private parseErrors;
    private documentChanged;
    constructor(initialSource: string, format: BrowserFormat);
    get mode(): EditorMode;
    get source(): string;
    get document(): StoredDocument | null;
    get errors(): readonly FormatIssue[];
    private openVisual;
    notifyVisualChange(newDocument: StoredDocument): void;
    toggleToSource(): void;
    toggleToVisual(): void;
    updateSource(newSource: string): void;
}
