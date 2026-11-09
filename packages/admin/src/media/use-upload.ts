import type { MediaItem } from "@monti-cms/core";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLeaveGuard } from "../draft/leave-guard";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";
import { putFile } from "./put-file";
import { nextToStart, stillGoing, type Upload, uploadQueue } from "./upload-queue";

const previewOf = (file: File) => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null);

/**
 * Files going up from a place on a page (doc 09's `useUpload`, 09-3): the library, the editor and a media field all use this one. `add` takes files where they were
 * dropped or chosen; each stays in `uploads` with its bar, and a failed one stays with its reason. A file that made it leaves the list and comes to `onUploaded`.
 */
export function useUpload(options: { onUploaded?: (item: MediaItem, upload: Upload) => void } = {}) {
	const { uploader, session } = useAdmin();
	const makeItem = useOperation<{ output: MediaItem }>("media.upload");
	const [uploads, dispatch] = useReducer(uploadQueue, []);
	// The files themselves, and how to stop one going up: not state, nothing on the screen draws from them.
	const files = useRef(new Map<string, File>());
	const stops = useRef(new Map<string, AbortController>());
	const onUploaded = useRef(options.onUploaded);
	onUploaded.current = options.onUploaded;

	const forget = useCallback((upload: Upload) => {
		files.current.delete(upload.id);
		stops.current.get(upload.id)?.abort();
		stops.current.delete(upload.id);
		if (upload.preview) URL.revokeObjectURL(upload.preview);
	}, []);

	const send = useCallback(
		async (upload: Upload) => {
			const file = files.current.get(upload.id);
			if (!file) return;
			const stop = new AbortController();
			stops.current.set(upload.id, stop);
			const put = await putFile(file, uploader, {
				signal: stop.signal,
				only: upload.only,
				onProgress: (percent) => dispatch({ type: "progress", id: upload.id, percent }),
			});
			// Taken out while it was going: nobody is waiting for it any more.
			if (stop.signal.aborted) return;
			if (!put.ok) {
				if (put.unauthenticated) session.end();
				dispatch({ type: "problem", id: upload.id, problem: put.problem });
				return;
			}
			// A request that never got an answer throws: it is the same "try again" as one that was refused, and must not hold its place in the queue.
			const made = await makeItem
				.run({
					name: file.name,
					folderId: upload.folder,
					original: put.original,
					...(put.web ? { web: put.web } : {}),
				})
				.catch(() => null);
			// Taken out while the library made it: it stays in the library, and takes no place here.
			if (stop.signal.aborted) return;
			if (!made?.ok) {
				dispatch({ type: "problem", id: upload.id, problem: "failed" });
				return;
			}
			onUploaded.current?.(made.body.output, upload);
			forget(upload);
			dispatch({ type: "remove", id: upload.id });
		},
		[uploader, session.end, makeItem.run, forget],
	);

	useEffect(() => {
		for (const upload of nextToStart(uploads)) {
			dispatch({ type: "start", id: upload.id });
			void send(upload);
		}
	}, [uploads, send]);

	// Nothing is left behind when the page goes.
	const latest = useRef(uploads);
	latest.current = uploads;
	useEffect(
		() => () => {
			for (const upload of latest.current) forget(upload);
		},
		[forget],
	);

	const add = useCallback((given: readonly File[], folder: string | null = null, only?: "image"): Upload[] => {
		const added = given.map((file): Upload => {
			const id = crypto.randomUUID();
			files.current.set(id, file);
			return {
				id,
				name: file.name,
				folder,
				...(only ? { only } : {}),
				preview: previewOf(file),
				status: "waiting",
				progress: 0,
				problem: null,
			};
		});
		if (added.length > 0) dispatch({ type: "add", uploads: added });
		return added;
	}, []);

	const remove = useCallback(
		(upload: Upload) => {
			forget(upload);
			dispatch({ type: "remove", id: upload.id });
		},
		[forget],
	);

	const retry = useCallback((upload: Upload) => dispatch({ type: "retry", id: upload.id }), []);

	/** Whether this is still a file of this page: on its way, or stopped with its reason. */
	const holds = useCallback((id: string) => files.current.has(id), []);

	// Files on their way would stop if the page went: leaving asks, as unsaved changes do (doc 05), and says it is files.
	useLeaveGuard({
		uploads: stillGoing(uploads),
		revertAll: () => {
			for (const each of uploads) remove(each);
		},
	});

	return { uploads, add, remove, retry, holds };
}
