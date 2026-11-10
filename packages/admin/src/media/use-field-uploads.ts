import type { MediaItem } from "@monti-cms/core";
import { useCallback, useRef, useState } from "react";
import type { Upload } from "./upload-queue";
import { useUpload } from "./use-upload";

/**
 * What someone says of the picture while its file goes up. It waits with the file: the field keeps what it had, so taking the file out leaves that as it was, and what the field
 * had says nothing of the new picture (2026-11-09, owner).
 */
export type SaidSince = { alt?: string; decorative?: boolean };

/**
 * The files going up for an entry's media fields. It belongs to the editor, not to a field: the property panel can close while a file goes, and the file still lands in its
 * field. One field has one file on its way; a new choice replaces it.
 */
export function useFieldUploads(onUploaded: (field: string, item: MediaItem, said: SaidSince) => void) {
	const owners = useRef(new Map<string, { field: string }>());
	const [said, setSaid] = useState<Record<string, SaidSince>>({});
	const saidNow = useRef(said);
	saidNow.current = said;
	const forget = useCallback((field: string) => {
		setSaid(({ [field]: _gone, ...rest }) => rest);
	}, []);
	const upload = useUpload({
		onUploaded: (item, done) => {
			const owner = owners.current.get(done.id);
			owners.current.delete(done.id);
			if (!owner) return;
			onUploaded(owner.field, item, saidNow.current[owner.field] ?? {});
			forget(owner.field);
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
			forget(field);
		},
		[uploads, remove, forget],
	);
	const add = useCallback(
		(field: string, file: File, folder: string | null, only?: "image") => {
			clear(field);
			const [made] = addUpload([file], folder, only);
			if (made) owners.current.set(made.id, { field });
		},
		[addUpload, clear],
	);
	const saidOf = useCallback((field: string): SaidSince => said[field] ?? {}, [said]);
	const say = useCallback((field: string, what: SaidSince) => {
		setSaid((now) => ({ ...now, [field]: { ...now[field], ...what } }));
	}, []);
	return { of, add, clear, remove, saidOf, say, retry: upload.retry };
}

export type FieldUploads = ReturnType<typeof useFieldUploads>;
