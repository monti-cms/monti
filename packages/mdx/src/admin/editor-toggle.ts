import type { BrowserFormat } from "@monti-cms/admin";
import type { StoredDocument } from "@monti-cms/core/document";
import type { FormatIssue } from "@monti-cms/core/format";
import { mdxBrowserFormat } from "./format";

export type EditorMode = "visual" | "source";

/**
 * The state of switching a body between the visual editor and its source text. The document is the source of truth; the text is what a format writes of it.
 * Opening a text that does not read keeps it as it is and stays in source mode; switching to source without having edited visually gives back the exact
 * text that was opened.
 */
export class EditorToggle {
	private currentMode: EditorMode;
	private sourceText: string;
	private visualDocument: StoredDocument | null;
	private parseErrors: FormatIssue[];
	private documentChanged: boolean;

	constructor(
		initialSource: string,
		private readonly format: BrowserFormat = mdxBrowserFormat,
	) {
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

	public get document(): StoredDocument | null {
		return this.visualDocument ? structuredClone(this.visualDocument) : null;
	}

	public get errors(): readonly FormatIssue[] {
		return structuredClone(this.parseErrors);
	}

	private openVisual(source: string): void {
		const result = this.format.import(source);
		if (!result.ok) {
			this.currentMode = "source";
			this.sourceText = source;
			this.visualDocument = null;
			this.parseErrors = structuredClone([...result.issues]);
			this.documentChanged = false;
		} else {
			this.currentMode = "visual";
			this.sourceText = source;
			this.visualDocument = result.doc;
			this.parseErrors = [];
			this.documentChanged = false;
		}
	}

	public notifyVisualChange(newDocument: StoredDocument): void {
		if (this.currentMode !== "visual") return;
		this.visualDocument = structuredClone(newDocument);
		this.documentChanged = true;
	}

	public toggleToSource(): void {
		if (this.currentMode === "source") return;
		if (this.visualDocument && this.documentChanged) this.sourceText = this.format.export(this.visualDocument);
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
