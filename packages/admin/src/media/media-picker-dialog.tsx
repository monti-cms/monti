import type { MediaItem, MediaQueryResult } from "@monti-cms/core";
import { FolderTile, MediaPicker, Text, TextButton, Tile } from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { searchScopes, useFolders } from "../screens/list/folders";
import { chooseFiles } from "./choose-files";
import { FileThumb, useFileDetail } from "./file-shown";

/** How many more files the window loads at a time. */
const PAGE = 100;
/** The most `media.query` gives at a time: past it, a search finds the file. */
const MOST = 1000;

/**
 * The library's window (doc 09's `MediaPicker`, 09-3): the one every place that takes a file opens. It is a file browser (2026-11-09, owner): the top or a folder shows its folders
 * and its own files, and an image's place shows images, a file's place files. A search looks as the library's screen does, through the folder's subfolders or, by the chip in
 * the search box, all of them. Picking
 * a tile and pressing the pill puts it in; uploading hands the files back to the page with the open folder, and they go up in place as if pasted (screens/media.md).
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
	/** The files chosen to upload, and the folder open when they were. */
	onFiles: (files: File[], folder: string | null) => void;
}) {
	const { t } = useAdmin();
	const [folder, setFolder] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [everywhere, setEverywhere] = useState(false);
	const [pickedId, setPicked] = useState<string | null>(null);
	const [shown, setShown] = useState(PAGE);
	const folders = useFolders("media", true);
	const here = folder === null ? undefined : folders.byId.get(folder);
	const looking = search !== "";
	const read = useRead<MediaQueryResult>(
		"media.query",
		{
			folder,
			scope: everywhere && looking ? "all" : "here",
			search,
			...(kind === "any" ? {} : { only: kind }),
			pageSize: shown,
		},
		{ afterWrites: true },
	);
	const items = read.data?.items ?? [];
	// What goes in is always a file in sight, whichever list a press landed on.
	const picked = items.find((item) => item.id === pickedId) ?? null;
	const subfolders = looking ? [] : folders.children(folder);
	const detail = useFileDetail(looking, here && !everywhere ? folders.path(here.id).map((up) => up.name) : []);
	/** What is in sight changes: what was picked goes with it, and the list starts over. */
	const startOver = () => {
		setPicked(null);
		setShown(PAGE);
	};
	const go = (next: string | null) => {
		startOver();
		setFolder(next);
		setSearch("");
		setEverywhere(false);
	};
	return (
		<MediaPicker
			open
			onOpenChange={(open) => !open && onClose()}
			title={title ?? t(kind === "file" ? "library.picker.file" : "library.picker.image")}
			topLabel={t("frame.media")}
			folders={folders.list.map((each) => ({ id: each.id, name: each.name, depth: each.depth }))}
			folder={folder}
			onFolderChange={go}
			foldersLabel={t("folders.tree")}
			search={search}
			onSearchChange={(next) => {
				startOver();
				setSearch(next);
				// Emptied, the box starts over on the open folder.
				if (next === "") setEverywhere(false);
			}}
			searchLabel={t("library.picker.search")}
			// Inside a folder the search box's chip says where a search looks, as on the library's page.
			scopes={here ? searchScopes(here.name, t) : undefined}
			scope={everywhere ? "all" : "here"}
			onScopeChange={(next) => {
				startOver();
				setEverywhere(next === "all");
			}}
			scopeLabel={t("list.searchIn")}
			uploadLabel={t("library.upload")}
			onUpload={() =>
				chooseFiles({
					accept: kind === "image" ? "image/*" : undefined,
					onFiles: (files) => onFiles(files, folder),
				})
			}
			confirmLabel={confirmLabel ?? t("library.picker.insert")}
			confirmHidden={picked === null}
			onConfirm={() => picked && onPick(picked)}
			subfolders={
				subfolders.length > 0
					? subfolders.map((each) => <FolderTile key={each.id} name={each.name} onClick={() => go(each.id)} />)
					: undefined
			}
			notice={
				read.data && items.length === 0 && subfolders.length === 0 ? (
					<Text variant="note" tone="subtle">
						{t(looking ? "library.nothingFound" : "library.picker.none")}
					</Text>
				) : undefined
			}
		>
			{items.map((item) => (
				<Tile
					key={item.id}
					title={item.name}
					detail={detail(item)}
					selected={picked?.id === item.id}
					onClick={() => setPicked(picked?.id === item.id ? null : item.id)}
					preview={<FileThumb item={item} />}
				/>
			))}
			{read.data && read.data.total > items.length && shown < MOST ? (
				<TextButton onClick={() => setShown(shown + PAGE)}>{t("library.picker.more")}</TextButton>
			) : null}
			{read.data && read.data.total > items.length && shown >= MOST ? (
				<Text variant="note" tone="subtle">
					{t("library.picker.narrow")}
				</Text>
			) : null}
		</MediaPicker>
	);
}
