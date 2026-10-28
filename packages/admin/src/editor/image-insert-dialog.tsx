"use client";

import { Image as ImageIcon } from "@carbon/icons-react";
import { type FolderListItem, fileTypeLabel, formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FilePreview,
	Image,
	MediaPicker,
	type MediaPickerFolder,
	Stack,
	Text,
	Tile,
} from "@monti-cms/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { mediaNotConfiguredMessage } from "../api/error-message";
import { foldersKeys, listFolders } from "../api/folders";
import { listMedia, type MediaItem, mediaKeys } from "../api/media";
import { commonMessages } from "../lib/common.messages";
import { useAdminFeatures } from "../screens/shared/admin-features";
import { LoadErrorAlert } from "../screens/shared/load-error-alert";
import { useDebounced } from "../screens/shared/use-debounced";
import type { TranslatorFor } from "../translator";
import { editorMediaMessages } from "./media.messages";
import { imageAccept } from "./upload-helper";

/** What the picker lists: images, or files that are not images. */
export type PickerKind = "image" | "file";

/** The library item that was chosen. */
export type PickedMedia = Pick<
	MediaItem,
	"id" | "filename" | "mimeType" | "byteSize" | "publicUrl" | "defaultAlt" | "defaultCaption"
>;

/** The folders as the list the picker shows: each top folder, then what is inside it. */
export function folderNav(folders: readonly FolderListItem[]): (FolderListItem & { depth: number })[] {
	const byParent = new Map<string | null, FolderListItem[]>();
	for (const folder of folders) {
		const list = byParent.get(folder.parentId) ?? [];
		list.push(folder);
		byParent.set(folder.parentId, list);
	}
	const out: (FolderListItem & { depth: number })[] = [];
	const walk = (parent: string | null, depth: number) => {
		for (const folder of (byParent.get(parent) ?? []).sort((a, b) => a.position - b.position)) {
			out.push({ ...folder, depth });
			walk(folder.id, depth + 1);
		}
	};
	walk(null, 0);
	return out;
}

interface MediaPickerDialogProps {
	open: boolean;
	kind: PickerKind;
	/** Defaults to the library's own name (images) or "Files". */
	title?: string;
	/** The pill: "Insert" in the body, "Pick" for a field. */
	confirmLabel?: string;
	onClose: () => void;
	/** The picked item. The picker closes itself. */
	onPick: (media: PickedMedia) => void;
	/** Files chosen with "Upload", and the folder that was open. The picker closes itself; the caller uploads and puts the result in. */
	onUpload: (files: File[], folderId: string | null) => void;
}

/**
 * The library as a picker: folders, search, and the files of the open folder as tiles. It serves "/ Image" (to insert), the cover image field
 * (to pick) and "/ File" (the files only). Pressing a tile marks it and the pill puts it in at once; there is no alt text or caption step. "Upload"
 * hands the chosen files to the caller, which puts them in the page as it does for a paste.
 */
export function MediaPickerDialog({
	open,
	kind,
	title: titleProp,
	confirmLabel: confirmProp,
	onClose,
	onPick,
	onUpload,
}: MediaPickerDialogProps) {
	const site = useSite();
	const t = useTranslator(editorMediaMessages);
	const tc = useTranslator(commonMessages);
	const { media } = useAdminFeatures();
	const files = kind === "file";
	const [folder, setFolder] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [picked, setPicked] = useState<MediaItem | null>(null);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) return;
		setFolder(null);
		setSearch("");
		setPicked(null);
	}, [open]);

	const foldersQuery = useQuery({
		queryKey: foldersKeys.list("media"),
		queryFn: ({ signal }) => listFolders(site, "media", signal),
		enabled: open && media,
		retry: false,
	});
	const nav: MediaPickerFolder[] = useMemo(
		() =>
			folderNav(foldersQuery.data ?? []).map((item) => ({
				id: item.id,
				name: item.name,
				depth: item.depth,
				// The number counts every kind of file in the folder, so it is shown only where it matches what is listed.
				...(files ? {} : { count: item.entryCount }),
			})),
		[foldersQuery.data, files],
	);

	// The list follows the typed name after a pause. The tiles already shown stay while the next ones load.
	const debouncedSearch = useDebounced(search.trim(), 250);
	const listQuery = useQuery({
		queryKey: mediaKeys.list(`picker:${kind}:${folder ?? "all"}:${debouncedSearch}`),
		queryFn: ({ signal }) => {
			const params = new URLSearchParams({ pageSize: "100", kind });
			if (folder) params.set("folderId", folder);
			if (debouncedSearch) params.set("search", debouncedSearch);
			return listMedia(site, params, signal);
		},
		enabled: open && media,
		placeholderData: keepPreviousData,
		retry: false,
	});
	const items = (listQuery.data?.items ?? []).filter((item) => item.status === "ready");
	const loading = listQuery.isFetching || search.trim() !== debouncedSearch;

	const notice = listQuery.isError
		? !loading && <LoadErrorAlert message={t("picker.loadFailed")} onRetry={() => void listQuery.refetch()} />
		: !loading &&
			items.length === 0 && (
				<Stack gap={0} paddingY={24} align="center">
					<Text as="p" tone="muted">
						{t("picker.empty")}
					</Text>
				</Stack>
			);
	const title = titleProp ?? (files ? t("picker.fileTitle") : t("picker.imageTitle"));
	const confirm = (item: MediaItem | null) => {
		if (!item) return;
		onPick(item);
		onClose();
	};

	if (!media) {
		return (
			<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{mediaNotConfiguredMessage(site)}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose}>
							{tc("close")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<>
			<MediaPicker
				open={open}
				onOpenChange={(next) => !next && onClose()}
				title={title}
				allLabel={files ? t("picker.allFiles") : t("picker.allImages")}
				folders={nav}
				folder={folder}
				onFolderChange={setFolder}
				foldersLabel={t("picker.folders")}
				search={search}
				onSearchChange={setSearch}
				searchLabel={t("picker.search")}
				uploadLabel={t("picker.upload")}
				onUpload={() => input.current?.click()}
				confirmLabel={confirmProp ?? t("picker.insert")}
				onConfirm={() => confirm(picked)}
				confirmDisabled={!picked}
				notice={notice}
			>
				{items.map((item) => (
					<Tile
						key={item.id}
						selected={picked?.id === item.id}
						onClick={() => setPicked(item)}
						onDoubleClick={() => confirm(item)}
						title={item.filename}
						detail={detailOf(t, item, files)}
						preview={
							files ? (
								<FilePreview ext={fileTypeLabel(item.filename, item.mimeType)} />
							) : (
								<Image src={item.publicUrl ?? undefined} alt="" ratio="photo" radius="none" fallback={ImageIcon} />
							)
						}
					/>
				))}
			</MediaPicker>
			<input
				ref={input}
				type="file"
				multiple={files}
				accept={files ? site.api.FILE_ACCEPT : imageAccept(site)}
				hidden
				aria-label={t("picker.fileInput")}
				onChange={(event) => {
					const chosen = Array.from(event.target.files ?? []);
					event.target.value = "";
					if (chosen.length === 0) return;
					onUpload(files ? chosen : chosen.slice(0, 1), folder);
					onClose();
				}}
			/>
		</>
	);
}

/** The mono line under a tile's name: size or type and size, and how many entries use it. */
function detailOf(t: TranslatorFor<typeof editorMediaMessages>, item: MediaItem, files: boolean) {
	const parts: string[] = [];
	if (files) {
		parts.push(fileTypeLabel(item.filename, item.mimeType));
		if (item.byteSize) parts.push(formatFileSize(item.byteSize));
	} else if (item.width && item.height) parts.push(`${item.width}×${item.height}`);
	else if (!item.publicUrl) parts.push(t("picker.noPreview"));
	if (item.referencesCount > 0) parts.push(t("picker.uses", { count: item.referencesCount }));
	return parts.join(" · ");
}
