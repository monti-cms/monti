import {
	Document,
	Edit,
	FolderAdd,
	Folder as FolderIcon,
	FolderMoveTo,
	FolderOpen,
	FolderParent,
	Link,
	RightPanelOpen,
	TrashCan,
	Upload,
} from "@carbon/icons-react";
import type { Folder, FolderListItem } from "@monti-cms/core/site";
import type { MediaItem } from "../../api/media";
import type { commonMessages } from "../../lib/common.messages";
import type { TranslatorFor } from "../../translator";
import type { MenuAction } from "../shared/action-menu";
import type { deleteMessages } from "../shared/delete.messages";
import { type FolderActions, moveTargetsFor } from "../shared/use-folder-actions";
import { mediaUsages, type PlaceName } from "./media-item";
import { folderChoices } from "./media-state";
import type { mediaMessages } from "./messages";

interface Names {
	t: TranslatorFor<typeof mediaMessages>;
	/** Names where in an entry a file is used. */
	placeName?: PlaceName;
	tc: TranslatorFor<typeof commonMessages>;
	td: TranslatorFor<typeof deleteMessages>;
}

/** The right-click menu of a folder tile, and its ⋯: open, rename, move, and the trash last. Rename is in place; the trash asks nothing and has an undo. */
export function folderMenu(
	folder: Folder,
	folders: readonly FolderListItem[],
	{ t, tc, td }: Names,
	handlers: { open: (folder: Folder) => void; actions: FolderActions },
): MenuAction[] {
	return [
		{ kind: "item", label: tc("open"), icon: FolderOpen, onSelect: () => handlers.open(folder) },
		{
			kind: "item",
			label: td("folder.menu.rename"),
			icon: Edit,
			onSelect: () => handlers.actions.requestRename(folder),
		},
		{
			kind: "sub",
			label: td("folder.menu.move"),
			icon: FolderMoveTo,
			items: [
				...(folder.parentId
					? [
							{
								kind: "item" as const,
								label: t("bulk.top"),
								icon: FolderParent,
								onSelect: () => handlers.actions.moveFolder(folder, null),
							},
						]
					: []),
				...moveTargetsFor(folder, [...folders]).map((target) => ({
					kind: "item" as const,
					label: target.name,
					icon: FolderIcon,
					onSelect: () => handlers.actions.moveFolder(folder, target.id),
				})),
			],
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: td("folder.menu.delete"),
			icon: TrashCan,
			destructive: true,
			onSelect: () => void handlers.actions.requestDelete(folder),
		},
	];
}

/**
 * The right-click menu of a file tile or row, and its ⋯: open, where it is used, to a folder. The trash is not here: the Del key, the panel's ⋯ and the
 * bulk bar take a file there.
 */
export function fileMenu(
	media: MediaItem,
	folders: readonly FolderListItem[],
	{ t, tc, placeName }: Names,
	handlers: {
		open: (media: MediaItem) => void;
		openEntry: (usage: { collection: string; entryId: string }) => void;
		move: (media: MediaItem, folderId: string | null) => void;
	},
): MenuAction[] {
	const targets = folderChoices(folders, new Set([media.folderId ?? null]));
	return [
		{ kind: "item", label: tc("open"), icon: RightPanelOpen, onSelect: () => handlers.open(media) },
		{
			kind: "sub",
			label: t("menu.usedIn"),
			icon: Link,
			emptyLabel: t("menu.usedInEmpty"),
			items: mediaUsages(media, placeName).map((usage) => ({
				kind: "item" as const,
				label: usage.title || tc("untitled"),
				// Where in the post it is used (a field's label, or the body), at the row's end as the board draws it.
				shortcut: usage.places.join(" · ") || undefined,
				icon: Document,
				onSelect: () => handlers.openEntry(usage),
			})),
		},
		...(folders.length > 0
			? [
					{
						kind: "sub" as const,
						label: t("menu.toFolder"),
						icon: FolderMoveTo,
						items: [
							...(media.folderId
								? [
										{
											kind: "item" as const,
											label: t("bulk.top"),
											icon: FolderParent,
											onSelect: () => handlers.move(media, null),
										},
									]
								: []),
							...targets.map(({ folder }) => ({
								kind: "item" as const,
								label: folder.name,
								icon: FolderIcon,
								onSelect: () => handlers.move(media, folder.id),
							})),
						],
					},
				]
			: []),
	];
}

/** The right-click menu of the empty space: upload, and a new folder. */
export function blankMenu(
	{ t }: Pick<Names, "t">,
	handlers: { upload: () => void; newFolder: () => void },
): MenuAction[] {
	return [
		{ kind: "item", label: t("menu.upload"), icon: Upload, onSelect: handlers.upload },
		{ kind: "item", label: t("menu.newFolder"), icon: FolderAdd, onSelect: handlers.newFolder },
	];
}
