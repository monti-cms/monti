import { acceptFile, HEAD_BYTES, type MediaKind } from "@monti-cms/core";
import type { Answer, Uploader } from "../operations/transport";
import { readPicture, webSize } from "./images";
import type { UploadProblem } from "./upload-queue";
import { problemOf } from "./upload-queue";

/** What `media.upload` and `media.replace` take for a file that went up. */
export type PutFile = {
	original: { key: string; width?: number; height?: number };
	web?: { key: string; width: number; height: number };
};

export type PutResult =
	| ({ ok: true; kind: MediaKind } & PutFile)
	| { ok: false; problem: UploadProblem; kind: MediaKind | null; unauthenticated?: boolean };

const keyOf = (answer: Answer) =>
	answer.status === 200 && typeof (answer.body as { key?: unknown } | null)?.key === "string"
		? (answer.body as { key: string }).key
		: null;

/**
 * Sends one file up, the one way there is (doc 09, 09-3: the library, the editor and a media field all come here): the rule for what the library takes, the picture's
 * size and its web copy, then the bytes. It makes no item: the caller runs `media.upload` or `media.replace` with what this gives.
 */
export async function putFile(
	file: File,
	uploader: Uploader,
	options: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
): Promise<PutResult> {
	const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
	const accepted = acceptFile({ name: file.name, size: file.size, head });
	const kind = accepted.ok || accepted.reason === "size" ? accepted.kind : null;
	const problem = problemOf(accepted);
	if (!accepted.ok && problem) return { ok: false, problem, kind };

	const picture = kind === "image" ? await readPicture(file) : null;
	if (kind === "image" && !picture) return { ok: false, problem: "unreadable", kind };

	const refused = (answer: Answer): PutResult => ({
		ok: false,
		problem: answer.status === 413 ? "tooBig" : answer.status === 415 ? "type" : "failed",
		kind,
		unauthenticated: answer.status === 401,
	});

	const up = await uploader(file, { name: file.name, onProgress: options.onProgress, signal: options.signal });
	const key = keyOf(up);
	if (!key) return refused(up);
	const original = { key, ...(picture ? { width: picture.width, height: picture.height } : {}) };
	const copy = picture && accepted.ok ? await webSize(picture, accepted.mime) : null;
	picture?.close();
	if (!copy) return { ok: true, kind: kind ?? "file", original };

	const webUp = await uploader(copy.blob, { name: copy.name, signal: options.signal });
	const webKey = keyOf(webUp);
	if (!webKey) return refused(webUp);
	return { ok: true, kind: kind ?? "file", original, web: { key: webKey, width: copy.width, height: copy.height } };
}
