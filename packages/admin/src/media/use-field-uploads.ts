import type { MediaItem } from "@monti-cms/core";
import { useCallback, useRef } from "react";
import { useLeaveGuard } from "../draft/leave-guard";
import type { Upload } from "./upload-queue";
import { useUpload } from "./use-upload";

/**
 * The files going up for an entry's media fields. It belongs to the editor, not to a field: the property panel can close while a file goes, and the file still lands in its
 * field. One field has one file on its way; a new choice replaces it.
 */
export function useFieldUploads(onUploaded: (field: string, item: MediaItem, alt: string | undefined) => void) {
	const owners = useRef(new Map<string, { field: string; alt: string | undefined }>());
	const upload = useUpload({
		onUploaded: (item, done) => {
			const owner = owners.current.get(done.id);
			owners.current.delete(done.id);
			if (owner) onUploaded(owner.field, item, owner.alt);
		},
	});
	const going = upload.uploads.filter((each) => each.status === "waiting" || each.status === "uploading");
	useLeaveGuard({
		changes: going,
		revertAll: () => {
			for (const each of upload.uploads) upload.remove(each);
		},
	});
	const { uploads, remove, add: addUpload } = upload;
	const of = useCallback(
		(field: string): Upload | null => uploads.find((each) => owners.current.get(each.id)?.field === field) ?? null,
		[uploads],
	);
	const clear = useCallback(
		(field: string) => {
			for (const each of uploads) if (owners.current.get(each.id)?.field === field) remove(each);
		},
		[uploads, remove],
	);
	const add = useCallback(
		(field: string, file: File, alt: string | undefined) => {
			clear(field);
			const [made] = addUpload([file]);
			if (made) owners.current.set(made.id, { field, alt });
		},
		[addUpload, clear],
	);
	return { of, add, clear, remove, retry: upload.retry, shrink: upload.shrink };
}

export type FieldUploads = ReturnType<typeof useFieldUploads>;
