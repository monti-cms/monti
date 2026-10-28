import { type FileKind, fileKindOf, type Site } from "@monti-cms/core/site";

/** Why a file in the upload queue did not go up. */
export type UploadProblem =
	/** The site does not take this kind of file (a HEIC picture, an .exe). It cannot be fixed; it can only be taken out. */
	| { kind: "type" }
	/** Over the size limit. A picture can be shrunk and tried again; another file can only be taken out. */
	| { kind: "size"; bytes: number; limit: number; shrinkable: boolean }
	/** The upload itself failed (the network, the storage). Trying again may work. */
	| { kind: "failed"; message: string };

/** One file the person gave to the library: waiting its turn, going up, or failed and staying in its place. */
export interface UploadEntry {
	id: string;
	file: File;
	/** The folder it goes into; `null` for the top. */
	folderId: string | null;
	status: "waiting" | "uploading" | "failed";
	/** 0 to 100 while it goes up. */
	percent: number;
	problem?: UploadProblem;
}

export const isUploadableImage = (site: Site, file: File): boolean => site.api.isAllowedImage(file.type);

/** What is wrong with a file before anything is sent, or `null`. The server stays the authority; this spares the upload and tells the person at once. */
export function checkUpload(site: Site, file: File): UploadProblem | null {
	if (isUploadableImage(site, file)) {
		// The original is kept next to the converted file, so it is the original that has to fit.
		const limit = site.api.MAX_MEDIA_BYTES;
		return file.size > limit ? { kind: "size", bytes: file.size, limit, shrinkable: true } : null;
	}
	if (!site.api.fileTypeFor(file.name)) return { kind: "type" };
	const limit = site.api.MAX_FILE_BYTES;
	return file.size > limit ? { kind: "size", bytes: file.size, limit, shrinkable: false } : null;
}

/** The kinds of file this site takes, in the order a person reads them: images, then PDF, ZIP and text, each only when the site allows one. */
export function acceptedKinds(site: Site): ("image" | FileKind)[] {
	const files = new Set(site.api.ALLOWED_FILE_MIME_TYPES.map((mime) => fileKindOf(mime)));
	return [
		...(site.api.ALLOWED_IMAGE_MIME_TYPES.length > 0 ? (["image"] as const) : []),
		...(["pdf", "archive", "text"] as const).filter((kind) => files.has(kind)),
	];
}

let counter = 0;
/** Puts files in the queue, each waiting, or failed at once for a problem that is known before sending. */
export function enqueue(site: Site, files: readonly File[], folderId: string | null): UploadEntry[] {
	return files.map((file) => {
		const problem = checkUpload(site, file);
		counter += 1;
		return {
			id: `upload-${counter}`,
			file,
			folderId,
			status: problem ? "failed" : "waiting",
			percent: 0,
			...(problem ? { problem } : {}),
		};
	});
}

/** The file that goes up next: the first waiting one, when none is going up. */
export const nextToUpload = (queue: readonly UploadEntry[]): UploadEntry | undefined =>
	queue.some((entry) => entry.status === "uploading") ? undefined : queue.find((entry) => entry.status === "waiting");

export const patchEntry = (queue: readonly UploadEntry[], id: string, patch: Partial<UploadEntry>): UploadEntry[] =>
	queue.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));

export const removeEntry = (queue: readonly UploadEntry[], id: string): UploadEntry[] =>
	queue.filter((entry) => entry.id !== id);

/** The extension shown on a file's tile ("pdf"), or an empty string. */
export const extensionOf = (name: string): string => /\.([^./\\]{1,8})$/.exec(name)?.[1]?.toLowerCase() ?? "";
