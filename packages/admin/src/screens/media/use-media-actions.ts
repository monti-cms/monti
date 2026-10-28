"use client";

import { type FolderListItem, type MediaTrashResult, useSite, useTranslator } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import { useQueryClient } from "@tanstack/react-query";
import { errorText } from "../../api/client";
import { foldersKeys } from "../../api/folders";
import { type MediaItem, mediaKeys, replaceMedia, trashMedia, updateMedia } from "../../api/media";
import { restoreTrash } from "../../api/trash";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { prepareUpload, uploadAttachment, uploadImageFile } from "../../editor/upload-helper";
import { deleteMessages } from "../shared/delete.messages";
import { keptFilesFolder, mediaTrashNotice } from "./media-trash";
import { mediaMessages } from "./messages";
import type { MediaLibraryView } from "./use-media-library";

/** What changes files: moving them to a folder, sending them to the trash (with its undo), saving a file's fields and putting another file in its place. */
export function useMediaActions(library: MediaLibraryView) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const td = useTranslator(deleteMessages);
	const queryClient = useQueryClient();
	const { folders, update, setPicked } = library;

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
			queryClient.invalidateQueries({ queryKey: foldersKeys.list("media") }),
		]);

	const destinationOf = (folderId: string | null, all: readonly FolderListItem[] = folders) => {
		const name = folderId ? all.find((folder) => folder.id === folderId)?.name : undefined;
		return name ? t("moved.toFolder", { name }) : t("moved.toTop");
	};

	/** Moves files to a folder (`null` for the top). One request each; the pick is let go. */
	const move = useCmsMutation<{ files: readonly MediaItem[]; folderId: string | null }>({
		fn: ({ files, folderId }, { site }) =>
			Promise.all(files.map((file) => updateMedia(site, file.id, { folderId }))).then(() => undefined),
		success: (_result, { files, folderId }) =>
			files.length === 1
				? t("moved.one", { name: files[0]?.filename ?? "", destination: destinationOf(folderId) })
				: t("moved.many", { count: files.length, destination: destinationOf(folderId) }),
		failure: t("moved.failed"),
		onSuccess: () => setPicked(new Set()),
		invalidate: [mediaKeys.all, foldersKeys.list("media")],
	});

	/** Puts files back from the trash (the toast's undo). */
	const undoTrash = async (ids: readonly string[]) => {
		try {
			const answer = await restoreTrash(
				site,
				ids.map((id) => ({ type: "media", id })),
			);
			if (!answer.every((result) => result.ok)) toast.error(td("undoFailed"));
		} catch (error) {
			toast.error(errorText(site, error, td("undoFailed")));
		}
		await refresh();
	};

	/**
	 * Moves files to the trash at once, with no question: they come back with the toast's undo. A file something uses stays where it is, and the toast says
	 * so with a "view" of the ones that stayed.
	 */
	const trash = useCmsMutation<readonly MediaItem[], MediaTrashResult>({
		fn: (files, { site }) =>
			trashMedia(
				site,
				files.map((file) => file.id),
				td("media.trashFailed"),
			),
		failure: td("media.trashFailed"),
		onSuccess: (result, files) => {
			const notice = mediaTrashNotice(site, files, result);
			toast(notice.message, {
				action:
					notice.action === "undo"
						? { label: td("undo"), onClick: () => void undoTrash(result.trashed) }
						: {
								label: td("view"),
								onClick: () =>
									update({
										folder: keptFilesFolder(files, result),
										used: "used",
										search: "",
										kind: "all",
										alt: "all",
										scope: "here",
										page: 1,
									}),
							},
			});
			setPicked(new Set());
			// A file that went to the trash cannot stay open.
			if (library.open && result.trashed.includes(library.open.id)) {
				library.setPanelDirty(false);
				void library.openFile(null);
			}
		},
		invalidate: [mediaKeys.all, foldersKeys.list("media")],
	});

	/** Saves what the panel holds (name, folder, descriptions) in one request. Failure is thrown as is so it shows inside the panel. */
	const save = useCmsMutation<{
		media: MediaItem;
		patch: { filename?: string; defaultAlt?: string; defaultCaption?: string; folderId?: string | null };
	}>({
		fn: ({ media, patch }, { site }) => updateMedia(site, media.id, patch, t("panel.saveFailed")),
		success: t("panel.saved"),
		failure: t("panel.saveFailed"),
		inline: true,
		invalidate: [mediaKeys.all, foldersKeys.list("media")],
	});

	/**
	 * Puts `file` in the place of `media`'s file. The new file is uploaded as usual (a picture shrunk to WebP, location removed), then the server moves it
	 * into the same media: the id, name, descriptions and every place that uses it stay. Rejects with the server's own message.
	 */
	const replaceFile = async (media: MediaItem, file: File, onProgress: (percent: number) => void) => {
		const uploaded = site.api.isImageType(media.mimeType)
			? await uploadImageFile(site, await prepareUpload(site, file), onProgress)
			: await uploadAttachment(site, file, onProgress);
		await replaceMedia(site, media.id, uploaded.mediaId, t("replace.failed"));
		toast(t("replace.done"));
		await refresh();
	};

	return { move, trash, save, replaceFile };
}
