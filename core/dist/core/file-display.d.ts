/** Display rules shared by the attached file card (editor and public screen). */
export type FileKind = "pdf" | "archive" | "text";
export declare function fileKindOf(mimeType: string | null | undefined): FileKind;
/** Format name shown on the card. Text and code files use the extension (`TS`, `MD`, etc.). */
export declare function fileTypeLabel(filename: string, mimeType: string | null | undefined): string;
export declare const formatFileSize: (bytes: number) => string;
