import type { MediaItem } from "@monti-cms/core";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLeaveGuard } from "../draft/leave-guard";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";
import { putFile } from "./put-file";
import { useSayRefused } from "./upload-problem";
import { nextToStart, stillGoing, type Upload, uploadQueue } from "./upload-queue";

const previewOf = (file: File) => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null);

/**
 * Files going up from a place on a page (doc 09's `useUpload`, 09-3): the library, the editor and a media field all use this one. `add` takes files where they were
 * dropped or chosen; each stays in `uploads` with its bar, and one the network cut off stays to try again. A file that made it leaves the list and comes to `onUploaded`.
 * One the library refuses leaves too, and a toast says why: `useAcceptFiles` keeps most of them from coming here at all, and this is for what shows only later (a broken picture, the server's own limit,
 * a folder that was deleted while the file went up).
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
	const sayRefused = useSayRefused();
	/** The queue as it is now, for what runs later than the render that started it. */
	const latest = useRef(uploads);
	latest.current = uploads;

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
				if (put.problem === "failed") {
					dispatch({ type: "failed", id: upload.id });
					return;
				}
				sayRefused([{ name: upload.name, refusal: put.problem }]);
				forget(upload);
				dispatch({ type: "remove", id: upload.id });
				return;
			}
			// A request that never got an answer is a refusal too (status 0): the same "try again" as any other, and it does not hold its place in the queue.
			const made = await makeItem.run({
				name: file.name,
				folderId: upload.folder,
				original: put.original,
				...(put.web ? { web: put.web } : {}),
				...(put.placeholder ? { placeholder: put.placeholder } : {}),
			});
			// Taken out while the library made it: it stays in the library, and takes no place here.
			if (stop.signal.aborted) return;
			if (!made.ok) {
				// The folder it was going to is gone: trying again would change nothing, so the file leaves its place and a toast says why, as for a file the
				// library does not take (2026-11-09, owner). Every other answer is "try again", which sends the bytes anew: no answer at all, the session ending,
				// bytes that are no longer there (`media.unknownKey`).
				if (made.refusal.reason?.key !== "folders.unknown") {
					dispatch({ type: "failed", id: upload.id });
					return;
				}
				// Those still waiting for the same folder would only be told the same, one toast each: they go with this one, in one toast. One of them
				// started since this render is stopped by `forget` and leaves by its id like the rest; one another refusal already took is no longer held.
				const gone = [
					upload,
					...latest.current.filter(
						(each) => each.status === "waiting" && each.folder === upload.folder && files.current.has(each.id),
					),
				];
				sayRefused(gone.map((each) => ({ name: each.name, refusal: "noFolder" })));
				for (const each of gone) {
					forget(each);
					dispatch({ type: "remove", id: each.id });
				}
				return;
			}
			onUploaded.current?.(made.body.output, upload);
			forget(upload);
			dispatch({ type: "remove", id: upload.id });
		},
		[uploader, session.end, makeItem.run, forget, sayRefused],
	);

	useEffect(() => {
		for (const upload of nextToStart(uploads)) {
			dispatch({ type: "start", id: upload.id });
			void send(upload);
		}
	}, [uploads, send]);

	// Nothing is left behind when the page goes.
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

	/** Whether this is still a file of this page: on its way, or cut off. */
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
