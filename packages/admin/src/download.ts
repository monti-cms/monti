import { type BackupOutput, type ZipFile, zipStream } from "@monti-cms/core";
import { readBytes } from "./operations/transport";

/** Hands the browser a file to save. */
export function download(name: string, file: Blob) {
	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	URL.revokeObjectURL(url);
}

/**
 * Saves a backup or an export as its zip (doc 14): the text files the operation gave, and with `media` each media file under `media/<key>`,
 * read from the address its storage gave as its turn comes. `onProgress` hears how far it is, 0 to 1, by the bytes of the media files (the
 * text files are small beside them). A file the storage no longer has is left out: the backup says what the site has.
 */
export async function saveBackup(
	backup: BackupOutput,
	options: { media: boolean; onProgress?: (share: number) => void },
): Promise<void> {
	const encoder = new TextEncoder();
	const total = options.media ? backup.media.reduce((sum, file) => sum + file.size, 0) : 0;
	let done = 0;
	async function* files(): AsyncGenerator<ZipFile> {
		for (const [name, text] of Object.entries(backup.files)) yield { name, bytes: encoder.encode(text) };
		if (!options.media) return;
		for (const file of backup.media) {
			const bytes = await readBytes(file.url);
			if (bytes) yield { name: `media/${file.key}`, bytes };
			done += file.size;
			options.onProgress?.(total === 0 ? 1 : Math.min(1, done / total));
		}
	}
	const parts: BlobPart[] = [];
	for await (const part of zipStream(files())) parts.push(part as Uint8Array<ArrayBuffer>);
	download(backup.name, new Blob(parts, { type: "application/zip" }));
}
