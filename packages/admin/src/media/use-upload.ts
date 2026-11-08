import type { MediaItem } from "@monti-cms/core";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";
import { shrunk } from "./images";
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
				onProgress: (percent) => dispatch({ type: "progress", id: upload.id, percent }),
			});
			// Taken out while it was going: nobody is waiting for it any more.
			if (stop.signal.aborted) return;
			if (!put.ok) {
				if (put.unauthenticated) session.end();
				dispatch({ type: "problem", id: upload.id, problem: put.problem, kind: put.kind });
				return;
			}
			const made = await makeItem.run({
				name: file.name,
				folderId: upload.folder,
				original: put.original,
				...(put.web ? { web: put.web } : {}),
			});
			if (!made.ok) {
				dispatch({ type: "problem", id: upload.id, problem: "failed", kind: put.kind });
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

	const add = useCallback((given: readonly File[], folder: string | null = null): Upload[] => {
		const added = given.map((file): Upload => {
			const id = crypto.randomUUID();
			files.current.set(id, file);
			return {
				id,
				name: file.name,
				size: file.size,
				kind: null,
				folder,
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

	/** "Shrink and retry": the same picture under the limit, in the same place. */
	const shrink = useCallback(async (upload: Upload) => {
		const file = files.current.get(upload.id);
		const smaller = file ? await shrunk(file) : null;
		if (!smaller) return dispatch({ type: "problem", id: upload.id, problem: "unreadable" });
		files.current.set(upload.id, smaller);
		dispatch({ type: "retry", id: upload.id, size: smaller.size, name: smaller.name });
	}, []);

	return { uploads, add, remove, retry, shrink, going: stillGoing(uploads) };
}
