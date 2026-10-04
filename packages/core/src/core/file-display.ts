/** Display rules shared by the attached file card (editor and public screen). */

export type FileKind = "pdf" | "archive" | "text";

export function fileKindOf(mimeType: string | null | undefined): FileKind {
	if (mimeType === "application/pdf") return "pdf";
	if (mimeType === "application/zip") return "archive";
	return "text";
}

/** Format name shown on the card. Text and code files use the extension (`TS`, `MD`, etc.). */
export function fileTypeLabel(filename: string, mimeType: string | null | undefined): string {
	if (mimeType === "application/pdf") return "PDF";
	if (mimeType === "application/zip") return "ZIP";
	const extension = filename.includes(".") ? filename.split(".").pop() : undefined;
	return extension ? extension.toUpperCase() : "TXT";
}

export const formatFileSize = (bytes: number): string =>
	bytes >= 1024 * 1024
		? `${(bytes / 1024 / 1024).toFixed(1)}MB`
		: bytes >= 1024
			? `${Math.round(bytes / 1024)}KB`
			: `${bytes}B`;
