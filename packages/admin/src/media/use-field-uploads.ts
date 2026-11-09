import type { MediaItem } from "@monti-cms/core";
import { useCallback, useRef } from "react";
import type { Upload } from "./upload-queue";
import { useUpload } from "./use-upload";

/** What someone said of the picture while its file went up: what was there before was for the old one (2026-11-09, owner). */
export type SaidSince = { alt?: boolean; decorative?: boolean };

/**
 * The files going up for an entry's media fields. It belongs to the editor, not to a field: the property panel can close while a file goes, and the file still lands in its
 * field. One field has one file on its way; a new choice replaces it.
 */
export function useFieldUploads(onUploaded: (field: string, item: MediaItem, said: SaidSince) => void) {
	const owners = useRef(new Map<string, { field: string; said: SaidSince }>());
	const upload = useUpload({
		onUploaded: (item, done) => {
			const owner = owners.current.get(done.id);
			owners.current.delete(done.id);
			if (owner) onUploaded(owner.field, item, owner.said);
		},
	});
	const { uploads, remove, add: addUpload } = upload;
	const of = useCallback(
		(field: string): Upload | null => uploads.find((each) => owners.current.get(each.id)?.field === field) ?? null,
		[uploads],
	);
	const clear = useCallback(
		(field: string) => {
			for (const each of uploads)
				if (owners.current.get(each.id)?.field === field) {
					owners.current.delete(each.id);
					remove(each);
				}
		},
		[uploads, remove],
	);
	const add = useCallback(
		(field: string, file: File, folder: string | null, only?: "image") => {
			clear(field);
			const [made] = addUpload([file], folder, only);
			if (made) owners.current.set(made.id, { field, said: {} });
		},
		[addUpload, clear],
	);
	/** Someone wrote the alt text or flipped the switch: if a file is on its way to this field, it is for that file. */
	const said = useCallback((field: string, what: keyof SaidSince) => {
		for (const owner of owners.current.values()) if (owner.field === field) owner.said[what] = true;
	}, []);
	return { of, add, clear, remove, said, retry: upload.retry };
}

export type FieldUploads = ReturnType<typeof useFieldUploads>;
