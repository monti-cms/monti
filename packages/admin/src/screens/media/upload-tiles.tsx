"use client";

import { Document } from "@carbon/icons-react";
import { formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import { FilePreview, Image, Tile } from "@monti-cms/ui";
import { useEffect, useMemo } from "react";
import { acceptedKinds, extensionOf, isUploadableImage, type UploadEntry } from "./media-upload";
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
	const failed = entry.status === "failed";
	const { problem } = entry;
	const remove = { label: t("upload.remove"), onClick: () => uploads.remove(entry.id) };

	let detail: string;
	let actions: { label: string; onClick: () => void; primary?: boolean }[] = [];
	if (!failed) {
		detail = entry.status === "uploading" ? t("upload.progress", { percent: entry.percent }) : t("upload.waiting");
	} else if (problem?.kind === "type") {
		// A picture in a format the site does not take says so; another file lists what is taken.
		detail = entry.file.type.startsWith("image/")
			? t("upload.unsupported")
			: t("upload.acceptedKinds", {
					kinds: acceptedKinds(site)
						.map((kind) => t(`upload.kind.${kind}` as "upload.kind.image"))
						.join(" · "),
				});
		actions = [remove];
	} else if (problem?.kind === "size") {
		detail = t("upload.tooLarge", { size: formatFileSize(problem.bytes), limit: formatFileSize(problem.limit) });
		actions = problem.shrinkable
			? [{ label: t("upload.shrink"), onClick: () => void uploads.shrink(entry), primary: true }, remove]
			: [remove];
	} else {
		detail = problem?.kind === "failed" ? problem.message : t("upload.failed");
		actions =
			problem?.kind === "failed" && problem.retry === false
				? [remove]
				: [{ label: t("upload.retry"), onClick: () => uploads.retry(entry), primary: true }, remove];
	}

	return (
		<li>
			<Tile
				preview={
					isImage ? (
						<Image src={preview} alt="" ratio="photo" radius="none" fallback={Document} />
					) : (
						<FilePreview extension={extensionOf(entry.file.name)} faint={failed} />
					)
				}
				title={entry.file.name}
				detail={detail}
				status={failed ? "failed" : "uploading"}
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
