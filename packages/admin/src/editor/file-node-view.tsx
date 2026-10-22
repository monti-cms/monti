"use client";

// design-system: drawing — the file card is a block inside the document, with its name written in place

import { type FileKind, fileKindOf, fileTypeLabel, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import { cn } from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { FileArchive, FileText, FileType } from "lucide-react";
import { getMedia, mediaKeys } from "../api/media";
import { commonMessages } from "../lib/common.messages";
import { BlockFrame, useBlockEditor } from "./blocks/use-block-editor";
import { editorMessages } from "./messages";

const ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

/** Edit view of the core file block (`blockViews.file`): the attached file card. Same look as the public view card, and the name can be edited directly. */
export function FileBlockView() {
	const t = useTranslator(editorMessages);
	const tc = useTranslator(commonMessages);
	const site = useSite();
	const block = useBlockEditor();
	const mediaId = typeof block.values.mediaId === "string" ? block.values.mediaId : "";
	const label = typeof block.values.label === "string" ? block.values.label : "";
	const { editable } = block;
	const lookup = useQuery({
		queryKey: mediaKeys.detail(mediaId),
		queryFn: ({ signal }) => getMedia(site, mediaId, signal),
		enabled: mediaId !== "",
		retry: false,
	});
	const media = lookup.isError ? "failed" : (lookup.data ?? null);

	const info = media && media !== "failed" ? media : null;
	const filename = info?.filename ?? "";
	const Icon = ICONS[fileKindOf(info?.mimeType)];
	const details =
		media === "failed"
			? t("fileNode.notFound")
			: info
				? [fileTypeLabel(filename, info.mimeType), info.byteSize ? formatFileSize(info.byteSize) : null]
						.filter(Boolean)
						.join(" · ")
				: tc("loading");

	return (
		<BlockFrame
			framed={false}
			data-file-block
			className="not-prose my-spacious flex items-center gap-normal rounded-lg border bg-monti-surface px-comfortable py-normal"
		>
			<Icon aria-hidden className="size-8 shrink-0 text-monti-muted" strokeWidth={1.5} />
			<div className="min-w-0 flex-1">
				<input
					aria-label={t("fileNode.displayName")}
					value={label}
					placeholder={filename || t("fileNode.fallbackName")}
					disabled={!editable}
					// Keep typed characters from leaking into the editor document.
					onKeyDown={(event) => event.stopPropagation()}
					onChange={(event) => block.setValues({ label: event.target.value || null })}
					className="w-full truncate bg-transparent font-medium text-monti-body outline-none placeholder:text-monti-default"
				/>
				<p className={cn("text-monti-caption text-monti-muted", media === "failed" && "text-monti-danger")}>
					{details}
				</p>
			</div>
		</BlockFrame>
	);
}
