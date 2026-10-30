import { type FileKind, fileKindOf, formatFileSize, type Site } from "@monti-cms/core/site";
import { mediaMessages } from "./messages";

/** Why a file in the upload queue did not go up. */
export type UploadProblem =
	/** The site does not take this kind of file (a HEIC picture, an .exe). It cannot be fixed; it can only be taken out. */
	| { kind: "type" }
	/** Over the size limit. A picture can be shrunk and tried again; another file can only be taken out. */
	| { kind: "size"; bytes: number; limit: number; shrinkable: boolean }
	/** The upload itself failed (the network, the storage). Trying again may work. */
	| { kind: "failed"; message: string; retry?: boolean };

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

/** Why a file cannot take the place of another, or `null`: a picture is replaced by a picture, and any other file by a file of the same type. */
export function replaceProblem(site: Site, media: { mimeType: string | null }, file: File): "kind" | "type" | null {
	const replacingImage = site.api.isImageType(media.mimeType);
	const isImage = isUploadableImage(site, file);
	if (replacingImage !== isImage) return "kind";
	if (replacingImage) return null;
	return site.api.fileTypeFor(file.name) === media.mimeType ? null : "type";
}

/** What can be done with a file of the upload queue that did not go up. */
export type UploadTileAction = "shrink" | "retry" | "remove";

/** How one file of the upload queue shows as a tile. */
export interface UploadTileView {
	/** Only a type that cannot be taken is `failed` (the red line); a file that is too large or did not go up is `interrupted`, its picture faded. */
	readonly status: "uploading" | "failed" | "interrupted";
	readonly detail: string;
	/** In the order shown; the first one that is not `remove` is the main one. */
	readonly actions: readonly UploadTileAction[];
	/** A picture of the file, its icon and extension, or nothing (a picture in a format the site does not take). */
	readonly preview: "image" | "file" | "none";
}

/** The tile of one file of the upload queue: waiting, going up with its progress, or failed with the reason and what can be done. */
export function uploadTileView(site: Site, entry: UploadEntry): UploadTileView {
	const t = site.createTranslator(mediaMessages);
	const failed = entry.status === "failed";
	const { problem } = entry;

	let detail: string;
	let actions: UploadTileAction[] = [];
	if (!failed) {
		detail = entry.status === "uploading" ? t("upload.progress", { percent: entry.percent }) : t("upload.waiting");
	} else if (problem?.kind === "type") {
		// A picture in a format the site does not take says so; another file lists what is taken.
		detail = entry.file.type.startsWith("image/")
			? t("upload.unsupported")
			: t("upload.acceptedKinds", {
					kinds: acceptedKinds(site)
						.map((kind) => t(`upload.kind.${kind}` as "upload.kind.image"))
						.join(" · "),
				});
		actions = ["remove"];
	} else if (problem?.kind === "size") {
		detail = t("upload.tooLarge", { size: formatFileSize(problem.bytes), limit: formatFileSize(problem.limit) });
		actions = problem.shrinkable ? ["shrink", "remove"] : ["remove"];
	} else {
		detail = problem?.kind === "failed" ? problem.message : t("upload.failed");
		actions = problem?.kind === "failed" && problem.retry === false ? ["remove"] : ["retry", "remove"];
	}

	// A picture in a format the site does not take has nothing to show: a blank tile with the red line. Any other file shows its icon and extension.
	const refusedPicture = problem?.kind === "type" && entry.file.type.startsWith("image/");
	return {
		status: !failed ? "uploading" : problem?.kind === "type" ? "failed" : "interrupted",
		detail,
		actions,
		preview: refusedPicture ? "none" : isUploadableImage(site, entry.file) ? "image" : "file",
	};
}
