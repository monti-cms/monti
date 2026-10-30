"use client";

import { Document } from "@carbon/icons-react";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { FilePreview, Image, Tile } from "@monti-cms/ui";
import { useEffect, useMemo } from "react";
import { extensionOf, isUploadableImage, type UploadEntry, uploadTileView } from "./media-upload";
import { mediaMessages } from "./messages";
import type { MediaUploads } from "./use-media-uploads";

/** A picture of the file being uploaded, from the file itself. It is let go when the tile goes. Where the browser cannot make one, there is none. */
function useLocalPreview(file: File, wanted: boolean): string | undefined {
	const url = useMemo(
		() => (wanted && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : undefined),
		[file, wanted],
	);
	useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
	return url;
}

/** One file of the upload queue as a tile: waiting, going up with its progress, or failed and staying in its place with what can be done. */
function UploadTile({ entry, uploads }: { entry: UploadEntry; uploads: MediaUploads }) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const isImage = isUploadableImage(site, entry.file);
	const preview = useLocalPreview(entry.file, isImage);
	const view = uploadTileView(site, entry);
	const remove = { label: t("upload.remove"), onClick: () => uploads.remove(entry.id) };
	const actions = view.actions.map((action) =>
		action === "shrink"
			? { label: t("upload.shrink"), onClick: () => void uploads.shrink(entry), primary: true }
			: action === "retry"
				? { label: t("upload.retry"), onClick: () => uploads.retry(entry), primary: true }
				: remove,
	);

	return (
		<li>
			<Tile
				preview={
					view.preview === "none" ? null : view.preview === "image" ? (
						<Image src={preview} alt="" ratio="photo" radius="none" fallback={Document} />
					) : (
						<FilePreview ext={extensionOf(entry.file.name).toUpperCase()} />
					)
				}
				title={entry.file.name}
				detail={view.detail}
				status={view.status}
				progress={entry.status === "uploading" ? entry.percent : undefined}
				actions={actions}
			/>
		</li>
	);
}

/** The files given to the library that are not in it yet, at the front of the grid. */
export function UploadTiles({ uploads }: { uploads: MediaUploads }) {
	return uploads.queue.map((entry) => <UploadTile key={entry.id} entry={entry} uploads={uploads} />);
}
