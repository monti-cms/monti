"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "../../api/client";
import {
	type PreparedUpload,
	prepareUpload,
	shrinkForUpload,
	uploadAttachment,
	uploadImageFile,
} from "../../editor/upload-helper";
import { enqueue, isUploadableImage, nextToUpload, patchEntry, removeEntry, type UploadEntry } from "./media-upload";
import { mediaMessages } from "./messages";

/**
 * The files the person gave to the library, as a queue shown in the grid: each waits its turn, goes up one at a time with its progress, and one that
 * fails stays in its place (with the reason) until it is taken out or tried again. A picture that was too large can be shrunk and sent again.
 * `onUploaded` is called after each file is in the library, so the screen reads the list again.
 */
export function useMediaUploads({ onUploaded }: { onUploaded: () => void }) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const [queue, setQueue] = useState<UploadEntry[]>([]);

	const patch = useCallback(
		(id: string, change: Partial<UploadEntry>) => setQueue((current) => patchEntry(current, id, change)),
		[],
	);

	// A file is started once: an effect that runs twice (Strict Mode) must not send it twice.
	const started = useRef(new Set<string>());

	const send = async (entry: UploadEntry, prepared?: PreparedUpload) => {
		started.current.add(entry.id);
		patch(entry.id, { status: "uploading", percent: 0, problem: undefined });
		const onProgress = (percent: number) => patch(entry.id, { percent });
		const options = { folderId: entry.folderId };
		try {
			if (isUploadableImage(site, entry.file)) {
				await uploadImageFile(site, prepared ?? (await prepareUpload(site, entry.file)), onProgress, options);
			} else {
				await uploadAttachment(site, entry.file, onProgress, options);
			}
			setQueue((current) => removeEntry(current, entry.id));
			onUploaded();
		} catch (error) {
			patch(entry.id, {
				status: "failed",
				problem: { kind: "failed", message: errorText(site, error, t("upload.failed")) },
			});
		}
	};

	const next = nextToUpload(queue);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the next file starts once, when it becomes the next
	useEffect(() => {
		if (next && !started.current.has(next.id)) void send(next);
	}, [next?.id]);

	return {
		queue,
		/** Puts files in the queue, for the folder they go into (`null` for the top). */
		add: (files: readonly File[], folderId: string | null) =>
			setQueue((current) => [...current, ...enqueue(site, files, folderId)]),
		remove: (id: string) => setQueue((current) => removeEntry(current, id)),
		retry: (entry: UploadEntry) => {
			started.current.delete(entry.id);
			patch(entry.id, { status: "waiting", percent: 0, problem: undefined });
		},
		/** Tries a picture that was over the size limit again as a smaller WebP, which goes up without its original. */
		shrink: async (entry: UploadEntry) => {
			patch(entry.id, { status: "uploading", percent: 0, problem: undefined });
			const prepared = await shrinkForUpload(site, entry.file);
			if (prepared) await send(entry, prepared);
			else
				patch(entry.id, {
					status: "failed",
					problem: { kind: "failed", message: t("upload.shrinkFailed"), retry: false },
				});
		},
	};
}

export type MediaUploads = ReturnType<typeof useMediaUploads>;
