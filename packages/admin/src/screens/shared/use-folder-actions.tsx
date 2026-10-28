"use client";

import { Edit, Folder as FolderIcon, FolderMoveTo, FolderParent, TrashCan } from "@carbon/icons-react";
import type { Folder, FolderTrashResult } from "@monti-cms/core/site";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	FormField,
	FormFieldError,
	Input,
	Label,
	Stack,
	toast,
} from "@monti-cms/ui";
import { useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useRef, useState } from "react";
import { errorText } from "../../api/client";
import { createFolder, deleteFolder, foldersKeys, getFolderContents, updateFolder } from "../../api/folders";
import { restoreTrashed } from "../../api/trash-restore";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import type { MenuAction } from "./action-menu";
import { useConfirm } from "./confirm-dialog";
import { deleteMessages } from "./delete.messages";
import { sharedMessages } from "./messages";

type NameDialog = { mode: "create"; parentId: string | null } | { mode: "rename"; folder: Folder };

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
 * Virtual folder create, rename, move and delete. The list's folder rows and the media library's folders share the same state and dialogs.
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
	const tc = useTranslator(commonMessages);
	const queryClient = useQueryClient();
	const { confirm, dialog: confirmDialog } = useConfirm();
	const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	// Closing the dialog returns focus to the button that opened it. If that button is gone (deleted folder), follow the browser default.
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const rememberFocus = () => {
		returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	};
	const restoreFocus = () => {
		const target = returnFocusRef.current;
		returnFocusRef.current = null;
		return target?.isConnected ? target : true;
	};

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
		rememberFocus();
		setError(null);
		setName("");
		setNameDialog({ mode: "create", parentId });
	};

	const requestRename = (folder: Folder) => {
		rememberFocus();
		setError(null);
		setName(folder.name);
		setNameDialog({ mode: "rename", folder });
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

	const save = useCmsMutation({
		fn: (dialog: NameDialog, { site }) => {
			const trimmed = name.trim();
			return dialog.mode === "create"
				? createFolder(site, { collection, name: trimmed, parentId: dialog.parentId }, t("folder.addFailed"))
				: updateFolder(
						site,
						dialog.folder.id,
						{ name: trimmed, expectedVersion: dialog.folder.version },
						t("folder.renameFailed"),
					);
		},
		success: (_result, dialog) => (dialog.mode === "create" ? t("folder.added", { name: name.trim() }) : tc("saved")),
		failure: t("folder.saveFailed"),
		inline: true,
		onSuccess: () => {
			setNameDialog(null);
			void onChanged();
		},
		onError: (err) => setError(errorText(site, err, t("folder.saveFailed"))),
	});

	const submitName = () => {
		if (!nameDialog || !name.trim()) return;
		setError(null);
		save.mutate(nameDialog);
	};

	/** Puts a folder back from the trash (the toast's undo). */
	const undoTrash = async (folder: Folder) => {
		try {
			const answer = await restoreTrashed(site, [{ type: "folder", id: folder.id }]);
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

	const createDirectMutation = useCmsMutation({
		fn: ({ name, parentId }: { name: string; parentId: string | null }, { site }) =>
			createFolder(site, { collection, name: name.trim(), parentId }, t("folder.addFailed")),
		success: (_result, { name }) => t("folder.added", { name: name.trim() }),
		failure: t("folder.saveFailed"),
		onSuccess: () => void onChanged(),
	});

	const renameDirectMutation = useCmsMutation({
		fn: ({ folder, name }: { folder: Folder; name: string }, { site }) =>
			updateFolder(site, folder.id, { name: name.trim(), expectedVersion: folder.version }, t("folder.renameFailed")),
		success: tc("saved"),
		failure: t("folder.saveFailed"),
		onSuccess: () => void onChanged(),
	});

	const createFolderDirect = async (name: string, parentId: string | null) => {
		const trimmed = name.trim();
		if (!trimmed) return;
		await createDirectMutation.mutateAsync({ name: trimmed, parentId });
	};

	const renameFolderDirect = async (folder: Folder, newName: string) => {
		const trimmed = newName.trim();
		if (!trimmed || trimmed === folder.name) return;
		await renameDirectMutation.mutateAsync({ folder, name: trimmed });
	};

	const dialogs = (
		<>
			<Dialog open={nameDialog !== null} onOpenChange={(open) => !open && setNameDialog(null)}>
				<DialogContent finalFocus={restoreFocus}>
					<DialogHeader>
						<DialogTitle>
							{nameDialog?.mode === "rename"
								? t("folder.renameTitle")
								: nameDialog?.parentId
									? tc("addSubfolder")
									: tc("addFolder")}
						</DialogTitle>
						<DialogDescription>
							{nameDialog?.mode === "create"
								? t("folder.location", { name: folderName(nameDialog.parentId) })
								: t("folder.uniqueName")}
						</DialogDescription>
					</DialogHeader>
					<Stack
						as="form"
						gap={16}
						onSubmit={(event) => {
							event.preventDefault();
							void submitName();
						}}
					>
						<FormField data-invalid={Boolean(error) || undefined}>
							<Label htmlFor="folder-name" hidden>
								{t("folder.nameLabel")}
							</Label>
							<Input
								id="folder-name"
								autoFocus
								value={name}
								maxLength={100}
								aria-invalid={Boolean(error) || undefined}
								onChange={(e) => setName(e.target.value)}
								onKeyDown={(event) => {
									// While composing Hangul, Enter is the key that finishes the character. Do not submit the form.
									if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
										event.preventDefault();
									}
								}}
							/>
							{error && <FormFieldError>{error}</FormFieldError>}
						</FormField>
						<DialogFormFooter
							onCancel={() => setNameDialog(null)}
							cancelLabel={tc("cancel")}
							submitLabel={tc("save")}
							busyLabel={tc("saving")}
							busy={save.isPending}
							disabled={!name.trim()}
						/>
					</Stack>
				</DialogContent>
			</Dialog>
			{confirmDialog}
		</>
	);

	return {
		requestCreate,
		requestRename,
		requestDelete,
		moveFolder,
		createFolderDirect,
		renameFolderDirect,
		dialogs,
	};
}

export type FolderActions = Pick<
	ReturnType<typeof useFolderActions>,
	"requestCreate" | "requestRename" | "requestDelete" | "moveFolder" | "createFolderDirect" | "renameFolderDirect"
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
