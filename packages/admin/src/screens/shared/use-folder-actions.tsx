"use client";

import { Edit, Folder as FolderIcon, FolderMoveTo, FolderParent, TrashCan } from "@carbon/icons-react";
import type { Folder, FolderTrashResult } from "@monti-cms/core/site";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import { useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useRef, useState } from "react";
import { errorText } from "../../api/client";
import { createFolder, deleteFolder, foldersKeys, getFolderContents, updateFolder } from "../../api/folders";
import { restoreTrash } from "../../api/trash";
import { useCmsMutation } from "../../api/use-cms-mutation";
import type { MenuAction } from "./action-menu";
import { useConfirm } from "./confirm-dialog";
import { deleteMessages } from "./delete.messages";
import { sharedMessages } from "./messages";

/** The name being typed in place: a new folder under `parentId` (`null` is the top level), or an existing folder's new name. */
export type FolderNaming = { mode: "create"; parentId: string | null } | { mode: "rename"; folder: Folder };

/** Parent candidates to move to, excluding `folder` and its descendants. The server also rejects cycles. */
export function moveTargetsFor(folder: Folder, folders: Folder[]): Folder[] {
	const blocked = new Set([folder.id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const candidate of folders) {
			if (candidate.parentId && blocked.has(candidate.parentId) && !blocked.has(candidate.id)) {
				blocked.add(candidate.id);
				grew = true;
			}
		}
	}
	return folders.filter((candidate) => !blocked.has(candidate.id) && candidate.id !== folder.parentId);
}

/** Whether `folderId` is `ancestorId` or lies inside it. A screen that shows a folder which goes to the trash leaves it. */
export function isInsideFolder(folders: readonly Folder[], folderId: string, ancestorId: string): boolean {
	const seen = new Set<string>();
	for (
		let at: string | null = folderId;
		at && !seen.has(at);
		at = folders.find((folder) => folder.id === at)?.parentId ?? null
	) {
		if (at === ancestorId) return true;
		seen.add(at);
	}
	return false;
}

/**
 * What the toast says after a folder went to the trash, and what its button does: an undo for a folder that went whole, and "view" when files that
 * are in use stayed behind.
 */
export function folderTrashNotice(
	site: Site,
	folder: Pick<Folder, "name" | "collection">,
	result: FolderTrashResult,
): { message: string; action: "undo" | "view" } {
	const t = site.createTranslator(deleteMessages);
	const name = folder.name;
	if (result.folder === null) {
		// A media folder with files in use stays, and only its other files went.
		return {
			message:
				result.files > 0 ? t("folder.partial", { name, moved: result.files, kept: result.kept }) : t("folder.keptAll"),
			action: "view",
		};
	}
	const message =
		folder.collection === "media"
			? result.files > 0
				? t("folder.done.files", { name, files: result.files })
				: t("folder.done.empty", { name })
			: result.entries > 0
				? t("folder.done", { name, entries: result.entries })
				: t("folder.done.empty", { name });
	return { message, action: "undo" };
}

/**
 * Right-click / `⋯` menu of a folder. The list's folder rows and the media library's folders use the same menu: rename, move, and the trash last.
 * (Subfolders are made with "add folder" inside a folder, not from its menu.) Move targets are folders excluding itself and its descendants.
 */
export function folderMenuActions(site: Site, folder: Folder, folders: Folder[], actions: FolderActions): MenuAction[] {
	const t = site.createTranslator(sharedMessages);
	const td = site.createTranslator(deleteMessages);
	const targets = moveTargetsFor(folder, folders);
	return [
		{
			kind: "item",
			label: td("folder.menu.rename"),
			icon: Edit,
			onSelect: () => actions.requestRename(folder),
		},
		{
			kind: "sub",
			label: td("folder.menu.move"),
			icon: FolderMoveTo,
			emptyLabel: t("folder.moveEmpty"),
			items: [
				...(folder.parentId
					? [
							{
								kind: "item" as const,
								label: t("folder.root"),
								icon: FolderParent,
								onSelect: () => void actions.moveFolder(folder, null),
							},
						]
					: []),
				...targets.map((target) => ({
					kind: "item" as const,
					label: target.name,
					icon: FolderIcon,
					onSelect: () => void actions.moveFolder(folder, target.id),
				})),
			],
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: td("folder.menu.delete"),
			icon: TrashCan,
			destructive: true,
			onSelect: () => void actions.requestDelete(folder),
		},
	];
}

/**
 * Virtual folder create, rename, move and delete. The list's folder rows and the media library's folders share the same state.
 *
 * Naming is done where the folder stands, with no dialog: `requestCreate` and `requestRename` set `naming`, and the row or tile of that folder shows a
 * {@link FolderNameField} while it is set. `commitName` sends it (an empty or unchanged name only closes), `cancelName` drops it. Once the folder list
 * is fresh, `focusFolderId` names the folder that takes focus (the one just made or renamed); the row that shows it calls `focusSettled`.
 * Delete moves the folder with everything inside to the trash as one unit and says so in a toast with an undo. It asks first only when the folder holds
 * a published entry, which leaves the site.
 */
export function useFolderActions({
	collection,
	folders,
	onChanged,
	onViewKept,
}: {
	collection: string;
	folders: Folder[];
	/** Called after a folder changed. `deleted` is the folder that went to the trash, so a screen showing it (or something inside it) can leave. */
	onChanged: (change?: { deleted?: Folder }) => Promise<void> | void;
	/** Shows the files that stayed in a media folder because something uses them (the toast's "View"). */
	onViewKept?: (folder: Folder) => void;
}) {
	const site = useSite();
	const t = useTranslator(sharedMessages);
	const td = useTranslator(deleteMessages);
	const queryClient = useQueryClient();
	const { confirm, dialog: confirmDialog } = useConfirm();
	const [naming, setNaming] = useState<FolderNaming | null>(null);
	const [focusFolderId, setFocusFolderId] = useState<string | null>(null);
	// A new folder that was dropped (Escape) hands focus back to what opened it ("+ Folder"); one that was made or renamed takes focus itself.
	const openerRef = useRef<HTMLElement | null>(null);

	const itemLabel = site.isCollection(collection)
		? site.COLLECTION_DEFINITIONS[collection].label
		: t("folder.defaultItemLabel");
	const folderName = (id: string | null) =>
		id
			? `'${folders.find((f) => f.id === id)?.name ?? t("folder.parentFallback")}'`
			: t("folder.rootName", { itemLabel });
	/** Destination + particle (the Korean dictionary attaches the particle). */
	const toFolder = (id: string | null) => t(id ? "folder.to.named" : "folder.to.root", { name: folderName(id) });

	const requestCreate = (parentId: string | null) => {
		openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		setNaming({ mode: "create", parentId });
	};

	const requestRename = (folder: Folder) => setNaming({ mode: "rename", folder });

	const cancelName = () => {
		const current = naming;
		setNaming(null);
		if (current?.mode === "rename") setFocusFolderId(current.folder.id);
		else if (openerRef.current?.isConnected) openerRef.current.focus();
		openerRef.current = null;
	};

	/** Moves a folder to another parent (or the top level). If the same name exists, the server rejects and explains. */
	const move = useCmsMutation({
		fn: ({ folder, parentId }: { folder: Folder; parentId: string | null }, { site }) =>
			updateFolder(site, folder.id, { parentId, expectedVersion: folder.version }, t("folder.moveFailed")),
		success: (_result, { folder, parentId }) =>
			t("folder.moved", { name: folder.name, destination: toFolder(parentId) }),
		failure: t("folder.moveFailed"),
		onSuccess: () => void onChanged(),
	});
	const moveFolder = (folder: Folder, parentId: string | null) => move.mutate({ folder, parentId });

	/** Settles after the folder list is fresh, so the field never leaves before the folder it made is there to take its place. */
	const settle = async (focus: string | null) => {
		await onChanged();
		setFocusFolderId(focus);
		setNaming(null);
	};

	const create = useCmsMutation<{ name: string; parentId: string | null }, Folder>({
		fn: (input, { site }) => createFolder(site, { collection, ...input }, t("folder.addFailed")),
		failure: t("folder.addFailed"),
		onSuccess: (created) => void settle(created.id),
		onError: () => setNaming(null),
	});

	const rename = useCmsMutation<{ folder: Folder; name: string }>({
		fn: ({ folder, name }, { site }) =>
			updateFolder(site, folder.id, { name, expectedVersion: folder.version }, t("folder.renameFailed")),
		failure: t("folder.renameFailed"),
		onSuccess: (_result, { folder }) => void settle(folder.id),
		onError: () => setNaming(null),
	});

	const commitName = (text: string) => {
		if (!naming) return;
		const name = text.trim();
		if (!name || (naming.mode === "rename" && name === naming.folder.name)) return cancelName();
		if (naming.mode === "create") create.mutate({ name, parentId: naming.parentId });
		else rename.mutate({ folder: naming.folder, name });
	};

	/** Puts a folder back from the trash (the toast's undo). */
	const undoTrash = async (folder: Folder) => {
		try {
			const answer = await restoreTrash(site, [{ type: "folder", id: folder.id }]);
			if (!answer.every((result) => result.ok)) toast.error(td("undoFailed"));
		} catch (err) {
			toast.error(errorText(site, err, td("undoFailed")));
		}
		await onChanged();
	};

	const remove = useCmsMutation<Folder, FolderTrashResult>({
		fn: (folder, { site }) => deleteFolder(site, folder.id, folder.version, t("folder.deleteFailed")),
		failure: t("folder.deleteFailed"),
		onSuccess: (result, folder) => {
			const notice = folderTrashNotice(site, folder, result);
			toast(notice.message, {
				action:
					notice.action === "undo"
						? { label: td("undo"), onClick: () => void undoTrash(folder) }
						: onViewKept
							? { label: td("view"), onClick: () => onViewKept(folder) }
							: undefined,
			});
			void onChanged({ deleted: folder });
		},
	});

	/**
	 * Moves the folder to the trash. A folder of entries is read first and asks only when it holds a published entry; a media folder never asks
	 * (files are not public pages). Everything else goes at once.
	 */
	const requestDelete = async (folder: Folder) => {
		if (collection !== "media") {
			try {
				const contents = await queryClient.fetchQuery({
					queryKey: foldersKeys.contents(folder.id),
					queryFn: ({ signal }) => getFolderContents(site, folder.id, signal),
					staleTime: 0,
					gcTime: 0,
				});
				if (
					contents.published > 0 &&
					!(await confirm({
						title: td("folder.ask.title", { name: folder.name }),
						description: td("folder.ask.body", { entries: contents.entries, published: contents.published }),
						confirmLabel: td("trash.ask.confirm"),
						destructive: true,
					}))
				)
					return;
			} catch (err) {
				toast.error(errorText(site, err, t("folder.loadFailed")));
				return;
			}
		}
		remove.mutate(folder);
	};

	const dialogs = confirmDialog;

	return {
		requestCreate,
		requestRename,
		requestDelete,
		moveFolder,
		naming,
		commitName,
		cancelName,
		focusFolderId,
		focusSettled: () => setFocusFolderId(null),
		/** The confirm dialog of a delete. Render once per screen. */
		dialogs,
	};
}

export type FolderActions = Pick<
	ReturnType<typeof useFolderActions>,
	| "requestCreate"
	| "requestRename"
	| "requestDelete"
	| "moveFolder"
	| "naming"
	| "commitName"
	| "cancelName"
	| "focusFolderId"
	| "focusSettled"
>;

/** Like a file explorer: F2 opens rename, Delete moves the folder to the trash (asking only if it holds a published entry). For the keydown of a folder row. */
export function folderKeyHandler(folder: Folder, actions: FolderActions) {
	return (event: KeyboardEvent) => {
		if (event.key === "F2") {
			event.preventDefault();
			actions.requestRename(folder);
		} else if (event.key === "Delete") {
			event.preventDefault();
			void actions.requestDelete(folder);
		}
	};
}
