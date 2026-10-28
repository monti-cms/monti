"use client";

import { fileTypeLabel, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import { FileBlock } from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { getMedia, mediaKeys } from "../api/media";
import { commonMessages } from "../lib/common.messages";
import { BlockFrame, useBlockEditor } from "./blocks/use-block-editor";
import { editorMediaMessages } from "./media.messages";

/** Edit view of the core file block (`blockViews.file`): the file as the page shows it, and the shown name can be changed in place. */
export function FileBlockView() {
	const t = useTranslator(editorMediaMessages);
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
	const failed = lookup.isError;
	const info = lookup.data ?? null;
	const filename = info?.filename ?? "";
	const meta = failed
		? t("fileNode.notFound")
		: info
			? [fileTypeLabel(filename, info.mimeType), info.byteSize ? formatFileSize(info.byteSize) : null]
					.filter(Boolean)
					.join(" · ")
			: tc("loading");

	return (
		<BlockFrame framed={false} data-file-block className="not-prose my-monti-24">
			<FileBlock
				aria-label={`${t("fileNode.fallbackName")} ${label || filename}`.trim()}
				name={label}
				placeholder={filename || t("fileNode.fallbackName")}
				nameLabel={t("fileNode.displayName")}
				onNameChange={(next) => block.setValues({ label: next || null })}
				disabled={!editable}
				meta={meta}
				tone={failed ? "danger" : "default"}
			/>
		</BlockFrame>
	);
}
