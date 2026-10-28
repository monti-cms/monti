"use client";

import { Edit, FolderAdd, Folder as FolderIcon, FolderMoveTo, FolderParent, TrashCan } from "@carbon/icons-react";
import type { Folder } from "@monti-cms/core/site";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
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
	List,
	ListItem,
	Stack,
	Text,
} from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { type KeyboardEvent, useRef, useState } from "react";
import { errorText } from "../../api/client";
import { createFolder, deleteFolder, foldersKeys, getFolderContents, updateFolder } from "../../api/folders";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import type { MenuAction } from "./action-menu";
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

/**
 * Right-click / `⋯` menu of a folder. The sidebar tree and the list's folder rows use the same menu.
 * Move targets are folders excluding itself and its descendants.
 */
export function folderMenuActions(site: Site, folder: Folder, folders: Folder[], actions: FolderActions): MenuAction[] {
	const t = site.createTranslator(sharedMessages);
	const tc = site.createTranslator(commonMessages);
	const targets = moveTargetsFor(folder, folders);
	return [
		{ kind: "item", label: tc("addSubfolder"), icon: FolderAdd, onSelect: () => actions.requestCreate(folder.id) },
		{
			kind: "item",
			label: tc("rename"),
			icon: Edit,
			onSelect: () => actions.requestRename(folder),
		},
		{
			kind: "sub",
			label: tc("move"),
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
			label: tc("delete"),
			icon: TrashCan,
			destructive: true,
			onSelect: () => void actions.requestDelete(folder),
		},
	];
}

/**
 * Virtual folder create, rename, move and delete. The sidebar tree and the list's folder rows share the same state and dialogs.
 * Delete proceeds after previewing the contents. Posts and child folders directly inside move to the parent, and posts are not deleted.
 */
export function useFolderActions({
	collection,
	folders,
	onChanged,
}: {
	collection: string;
	folders: Folder[];
	onChanged: (deletedId?: string) => Promise<void> | void;
}) {
	const site = useSite();
	const t = useTranslator(sharedMessages);
	const tc = useTranslator(commonMessages);
	const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
	const [name, setName] = useState("");
	const [deleteDialog, setDeleteDialog] = useState<{ folder: Folder } | null>(null);
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

	const requestDelete = (folder: Folder) => {
		rememberFocus();
		setError(null);
		setDeleteDialog({ folder });
	};

	// What the delete would move to the parent, read while the dialog is open.
	const contentsQuery = useQuery({
		queryKey: foldersKeys.contents(deleteDialog?.folder.id ?? ""),
		queryFn: ({ signal }) => getFolderContents(site, deleteDialog?.folder.id ?? "", signal),
		enabled: deleteDialog !== null,
		gcTime: 0,
		retry: false,
	});
	const contents = deleteDialog ? (contentsQuery.data ?? null) : null;
	const shownError =
		error ??
		(deleteDialog && contentsQuery.error ? errorText(site, contentsQuery.error, t("folder.loadFailed")) : null);

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

	const remove = useCmsMutation({
		fn: ({ folder }: { folder: Folder }, { site }) =>
			deleteFolder(site, folder.id, folder.version, t("folder.deleteFailed")),
		success: (_result, { folder }) =>
			contents && contents.entryCount + contents.childFolders.length > 0
				? t("folder.deletedMoved", { name: folder.name, destination: toFolder(folder.parentId) })
				: t("folder.deleted", { name: folder.name }),
		failure: t("folder.deleteFailed"),
		inline: true,
		onSuccess: (_result, { folder }) => {
			setDeleteDialog(null);
			void onChanged(folder.id);
		},
		// If a child folder name collides in the parent, guide the user to rename first.
		onError: (err) => setError(errorText(site, err, t("folder.deleteFailed"))),
	});
	const isBusy = save.isPending || remove.isPending;

	const confirmDelete = () => {
		if (!deleteDialog) return;
		setError(null);
		remove.mutate(deleteDialog);
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

	const destination = deleteDialog ? toFolder(deleteDialog.folder.parentId) : "";

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
						<FormField data-invalid={Boolean(shownError) || undefined}>
							<Label htmlFor="folder-name" hidden>
								{t("folder.nameLabel")}
							</Label>
							<Input
								id="folder-name"
								autoFocus
								value={name}
								maxLength={100}
								aria-invalid={Boolean(shownError) || undefined}
								onChange={(e) => setName(e.target.value)}
								onKeyDown={(event) => {
									// While composing Hangul, Enter is the key that finishes the character. Do not submit the form.
									if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
										event.preventDefault();
									}
								}}
							/>
							{shownError && <FormFieldError>{shownError}</FormFieldError>}
						</FormField>
						<DialogFormFooter
							onCancel={() => setNameDialog(null)}
							cancelLabel={tc("cancel")}
							submitLabel={tc("save")}
							busyLabel={tc("saving")}
							busy={isBusy}
							disabled={!name.trim()}
						/>
					</Stack>
				</DialogContent>
			</Dialog>

			<AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
				<AlertDialogContent finalFocus={restoreFocus}>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("folder.deleteTitle", { name: deleteDialog?.folder.name ?? "" })}</AlertDialogTitle>
						<AlertDialogDescription>{t("folder.deleteAsk", { itemLabel, destination })}</AlertDialogDescription>
					</AlertDialogHeader>
					{contents ? (
						<List>
							<ListItem>{t("folder.entryCount", { itemLabel, count: contents.entryCount })}</ListItem>
							<ListItem>
								{t("folder.childCount", { count: contents.childFolders.length })}
								{contents.childFolders.length > 0 &&
									`: ${contents.childFolders.map((folder) => folder.name).join(", ")}`}
							</ListItem>
						</List>
					) : (
						!shownError && (
							<Text as="p" tone="subtle" role="status">
								{tc("loading")}
							</Text>
						)
					)}
					{shownError && <FormFieldError>{shownError}</FormFieldError>}
					<AlertDialogFooter>
						<AlertDialogCancel type="button">{tc("cancel")}</AlertDialogCancel>
						<Button
							type="button"
							variant="outline-danger"
							disabled={!contents || isBusy}
							onClick={() => void confirmDelete()}
						>
							{isBusy ? tc("deleting") : tc("delete")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
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

/** Like a file explorer: F2 opens rename, Delete opens delete (confirm dialog). For the keydown of a folder row. */
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
