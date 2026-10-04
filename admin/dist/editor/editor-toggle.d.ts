import type { CmsMdxError, CmsNode } from "@monti-cms/core/mdx";
export type EditorMode = "visual" | "source";
export declare class EditorToggle {
    private currentMode;
    private sourceText;
    private visualDocument;
    private parseErrors;
    private documentChanged;
    constructor(initialSource: string);
    get mode(): EditorMode;
    get source(): string;
    get document(): CmsNode | null;
    get errors(): readonly CmsMdxError[];
    private openVisual;
    notifyVisualChange(newDocument: CmsNode): void;
    toggleToSource(): void;
    toggleToVisual(): void;
    updateSource(newSource: string): void;
}
