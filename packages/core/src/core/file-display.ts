/** 첨부 파일 카드(에디터·공개 화면)가 함께 쓰는 표시 규칙(v3). */

export type FileKind = "pdf" | "archive" | "text";

export function fileKindOf(mimeType: string | null | undefined): FileKind {
	if (mimeType === "application/pdf") return "pdf";
	if (mimeType === "application/zip") return "archive";
	return "text";
}

/** 카드에 보일 형식 이름. 글자·코드 파일은 확장자를 쓴다(`TS`, `MD` 등). */
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
