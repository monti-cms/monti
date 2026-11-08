import type { MediaItem } from "@monti-cms/core";
import { useCallback, useRef } from "react";
import type { Upload } from "./upload-queue";
import { useUpload } from "./use-upload";

/**
 * The files going up for an entry's media fields. It belongs to the editor, not to a field: the property panel can close while a file goes, and the file still lands in its
 * field. One field has one file on its way; a new choice replaces it.
 */
export function useFieldUploads(onUploaded: (field: string, item: MediaItem) => void) {
	const owners = useRef(new Map<string, string>());
	const upload = useUpload({
		onUploaded: (item, done) => {
			const owner = owners.current.get(done.id);
			owners.current.delete(done.id);
			if (owner) onUploaded(owner, item);
		},
	});
	const { uploads, remove, add: addUpload } = upload;
	const of = useCallback(
		(field: string): Upload | null => uploads.find((each) => owners.current.get(each.id) === field) ?? null,
		[uploads],
	);
	const clear = useCallback(
		(field: string) => {
			for (const each of uploads)
				if (owners.current.get(each.id) === field) {
					owners.current.delete(each.id);
					remove(each);
				}
		},
		[uploads, remove],
	);
	const add = useCallback(
		(field: string, file: File, only?: "image") => {
			clear(field);
			const [made] = addUpload([file], null, only);
			if (made) owners.current.set(made.id, field);
		},
		[addUpload, clear],
	);
	return { of, add, clear, remove, retry: upload.retry, shrink: upload.shrink };
}

export type FieldUploads = ReturnType<typeof useFieldUploads>;
