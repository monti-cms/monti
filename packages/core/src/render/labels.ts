/** Fixed texts of the core default components. Passed in the site language. */
export interface RenderLabels {
	readonly imageUnavailable: string;
	readonly fileUnavailable: string;
	readonly download: string;
	readonly showFoldedCode: string;
	readonly copyCode: string;
	readonly copied: string;
	readonly codeNotes: string;
	/** The hidden heading of the footnote section. */
	readonly footnotes: string;
	/** The accessible name of a link back from a footnote to its reference. `{ref}` is the reference number (`1`, `1-2`). */
	readonly footnoteBack: string;
}

export const DEFAULT_LABELS: RenderLabels = {
	imageUnavailable: "Image unavailable",
	fileUnavailable: "File unavailable",
	download: "Download",
	showFoldedCode: "Show folded code",
	copyCode: "Copy",
	copied: "Copied",
	codeNotes: "Code notes",
	footnotes: "Footnotes",
	footnoteBack: "Back to reference {ref}",
};
