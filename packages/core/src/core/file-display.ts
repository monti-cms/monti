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

/** A file size as the screens write it: "1.2 MB" (one decimal under 10), "14 MB", "180 KB", "640 B". */
export const formatFileSize = (bytes: number): string => {
	const mb = bytes / 1024 / 1024;
	if (mb >= 1) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
	return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
};
