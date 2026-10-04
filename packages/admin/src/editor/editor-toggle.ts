import type { CmsMdxError, CmsNode } from "@monti-cms/core/mdx";
import { SourceConverter } from "@monti-cms/core/mdx";

export type EditorMode = "visual" | "source";

export class EditorToggle {
	private currentMode: EditorMode;
	private sourceText: string;
	private visualDocument: CmsNode | null;
	private parseErrors: CmsMdxError[];
	private documentChanged: boolean;

	constructor(initialSource: string) {
		this.sourceText = initialSource;
		this.currentMode = "source";
		this.visualDocument = null;
		this.parseErrors = [];
		this.documentChanged = false;
		this.openVisual(initialSource);
	}

	public get mode(): EditorMode {
		return this.currentMode;
	}

	public get source(): string {
		return this.sourceText;
	}

	public get document(): CmsNode | null {
		return this.visualDocument ? structuredClone(this.visualDocument) : null;
	}

	public get errors(): readonly CmsMdxError[] {
		return structuredClone(this.parseErrors);
	}

	private openVisual(source: string, name?: string): void {
		const result = SourceConverter.toVisual(source, name);
		if (result.type === "error") {
			this.currentMode = "source";
			this.sourceText = source;
			this.visualDocument = null;
			this.parseErrors = structuredClone(result.errors);
			this.documentChanged = false;
		} else {
			this.currentMode = "visual";
			this.sourceText = result.originalSource;
			this.visualDocument = result.document;
			this.parseErrors = [];
			this.documentChanged = false;
		}
	}

	public notifyVisualChange(newDocument: CmsNode): void {
		if (this.currentMode !== "visual") return;
		this.visualDocument = structuredClone(newDocument);
		this.documentChanged = true;
	}

	public toggleToSource(): void {
		if (this.currentMode === "source") return;

		if (this.visualDocument) {
			this.sourceText = SourceConverter.toSource(
				{
					originalSource: this.sourceText,
					document: this.visualDocument,
				},
				this.documentChanged,
			);
		}

		this.currentMode = "source";
	}

	public toggleToVisual(): void {
		if (this.currentMode === "visual") return;
		this.openVisual(this.sourceText);
	}

	public updateSource(newSource: string): void {
		if (this.currentMode !== "source") return;
		this.sourceText = newSource;
	}
}
