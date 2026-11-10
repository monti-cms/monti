import { acceptFile, HEAD_BYTES } from "@monti-cms/core";
import type { Answer, Uploader } from "../operations/transport";
import { placeholderOf, readPicture, webSize } from "./images";
import type { Refusal } from "./upload-queue";

/** What `media.upload` and `media.replace` take for a file that went up. */
export type PutFile = {
	original: { key: string; width?: number; height?: number };
	web?: { key: string; width: number; height: number };
	/** A picture's blurred stand-in for the site. */
	placeholder?: string;
};

export type PutResult =
	| ({ ok: true } & PutFile)
	| { ok: false; problem: Refusal | "failed"; unauthenticated?: boolean };

const keyOf = (answer: Answer) =>
	answer.status === 200 && typeof (answer.body as { key?: unknown } | null)?.key === "string"
		? (answer.body as { key: string }).key
		: null;

/** What can be told of a file without sending it: its first bytes and its size, in no time. */
async function lookAt(file: File, only?: "image") {
	// A folder dropped from the OS arrives as a file that cannot be read.
	const head = await file
		.slice(0, HEAD_BYTES)
		.arrayBuffer()
		.then((bytes) => new Uint8Array(bytes))
		.catch(() => null);
	if (!head) return { ok: false as const, refusal: "unreadable" as const };
	const accepted = acceptFile({ name: file.name, size: file.size, head });
	const kind = accepted.ok || accepted.reason === "size" ? accepted.kind : null;
	if (only === "image" && kind === "file") return { ok: false as const, refusal: "notImage" as const };
	if (accepted.ok) return accepted;
	return { ok: false as const, refusal: accepted.reason === "size" ? ("tooBig" as const) : ("type" as const) };
}

/** Why the library will not take this file, when that shows before it is sent. */
export const refusalOf = async (file: File, only?: "image"): Promise<Refusal | null> => {
	const looked = await lookAt(file, only);
	return looked.ok ? null : looked.refusal;
};

/**
 * Sends one file up, the one way there is (doc 09, 09-3: the library, the editor and a media field all come here): the rule for what the library takes, the picture's
 * size and its web copy, then the bytes. It makes no item: the caller runs `media.upload` or `media.replace` with what this gives.
 */
export async function putFile(
	file: File,
	uploader: Uploader,
	options: { onProgress?: (percent: number) => void; signal?: AbortSignal; only?: "image" } = {},
): Promise<PutResult> {
	const looked = await lookAt(file, options.only);
	if (!looked.ok) return { ok: false, problem: looked.refusal };

	const picture = looked.kind === "image" ? await readPicture(file) : null;
	if (looked.kind === "image" && !picture) return { ok: false, problem: "unreadable" };

	const refused = (answer: Answer): PutResult => ({
		ok: false,
		problem: answer.status === 413 ? "tooBig" : answer.status === 415 ? "type" : "failed",
		unauthenticated: answer.status === 401,
	});

	const up = await uploader(file, { name: file.name, onProgress: options.onProgress, signal: options.signal });
	const key = keyOf(up);
	if (!key) return refused(up);
	const original = { key, ...(picture ? { width: picture.width, height: picture.height } : {}) };
	const copy = picture ? await webSize(picture, looked.mime) : null;
	const placeholder = picture ? await placeholderOf(picture) : undefined;
	picture?.close();
	const made = { ok: true as const, original, ...(placeholder ? { placeholder } : {}) };
	if (!copy) return made;

	const webUp = await uploader(copy.blob, { name: copy.name, signal: options.signal });
	const webKey = keyOf(webUp);
	if (!webKey) return refused(webUp);
	return { ...made, web: { key: webKey, width: copy.width, height: copy.height } };
}
