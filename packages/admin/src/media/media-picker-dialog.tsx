import type { MediaItem, MediaQueryResult } from "@monti-cms/core";
import { FilePreview, Image, MediaPicker, Text, TextButton, Tile } from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { useFolders } from "../screens/list/folders";
import { chooseFiles } from "./choose-files";
import { extensionLabel, formatBytes, previewUrl, sizeLabel } from "./file-text";

/** How many more files the window loads at a time. */
const PAGE = 100;

/**
 * The library's window (doc 09's `MediaPicker`, 09-3): the one every place that takes a file opens. An image's place shows images, a file's place files. Picking a tile and
 * pressing the pill puts it in; uploading hands the files back to the page, where they go up in place as if pasted (screens/media.md).
 */
export function MediaPickerDialog({
	kind,
	title,
	confirmLabel,
	onClose,
	onPick,
	onFiles,
}: {
	kind: "image" | "file" | "any";
	title?: string;
	confirmLabel?: string;
	onClose: () => void;
	onPick: (item: MediaItem) => void;
	onFiles: (files: File[]) => void;
}) {
	const { t } = useAdmin();
	const [folder, setFolder] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [picked, setPicked] = useState<MediaItem | null>(null);
	const [shown, setShown] = useState(PAGE);
	const folders = useFolders("media", true);
	const read = useRead<MediaQueryResult>(
		"media.query",
		{ ...(folder === null ? {} : { folder }), search, kinds: kind === "any" ? [] : [kind], pageSize: shown },
		{ afterWrites: true },
	);
	const items = read.data?.items ?? [];
	return (
		<MediaPicker
			open
			onOpenChange={(open) => !open && onClose()}
			title={title ?? t(kind === "file" ? "library.picker.file" : "library.picker.image")}
			allLabel={t(kind === "image" ? "library.picker.allImages" : "library.picker.allFiles")}
			// A folder's count is of all its files, so it shows only where images are what is listed (components/list.md).
			folders={folders.list.map((each) => ({
				id: each.id,
				name: each.name,
				depth: each.depth,
				...(kind === "image" ? { count: each.count } : {}),
			}))}
			folder={folder}
			onFolderChange={(next) => {
				setPicked(null);
				setShown(PAGE);
				setFolder(next);
			}}
			foldersLabel={t("folders.tree")}
			search={search}
			onSearchChange={(next) => {
				setShown(PAGE);
				setSearch(next);
			}}
			searchLabel={t("library.picker.search")}
			uploadLabel={t("library.upload")}
			onUpload={() =>
				chooseFiles({
					accept: kind === "image" ? "image/*" : undefined,
					onFiles,
				})
			}
			confirmLabel={confirmLabel ?? t("library.picker.insert")}
			confirmHidden={picked === null}
			onConfirm={() => picked && onPick(picked)}
			notice={
				read.data && items.length === 0 ? (
					<Text variant="note" tone="subtle">
						{t("library.picker.none")}
					</Text>
				) : undefined
			}
		>
			{items.map((item) => (
				<Tile
					key={item.id}
					title={item.name}
					detail={[
						item.kind === "image" ? sizeLabel(item) : formatBytes(item.size),
						item.uses > 0 ? t("library.usedBy", { count: item.uses }) : t("library.notUsed"),
					]
						.filter(Boolean)
						.join(" · ")}
					selected={picked?.id === item.id}
					onClick={() => setPicked(picked?.id === item.id ? null : item)}
					preview={
						item.kind === "image" ? (
							<Image src={previewUrl(item)} alt="" ratio="photo" radius="none" />
						) : (
							<FilePreview ext={extensionLabel(item.name)} />
						)
					}
				/>
			))}
			{read.data && read.data.total > items.length && (
				<TextButton onClick={() => setShown(shown + PAGE)}>{t("library.picker.more")}</TextButton>
			)}
		</MediaPicker>
	);
}
