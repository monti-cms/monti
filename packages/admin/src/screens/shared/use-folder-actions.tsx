"use client";

import { cmsApiUrl, type Site, useSite, useTranslator } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { Folder as FolderIcon, FolderInput, FolderPlus, FolderUp, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Field, FieldError, FieldLabel } from "../../ui/field";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { cmsFetch, errorText } from "../admin-api";
import type { MenuAction } from "./action-menu";
import { sharedMessages } from "./messages";

type NameDialog = { mode: "create"; parentId: string | null } | { mode: "rename"; folder: Folder };

interface DeleteDialog {
	folder: Folder;
	contents: { entryCount: number; childFolders: Folder[] } | null;
}

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
	const targets = moveTargetsFor(folder, folders);
	return [
		{ kind: "item", label: t("folder.addChild"), icon: FolderPlus, onSelect: () => actions.requestCreate(folder.id) },
		{
			kind: "item",
			label: t("folder.rename"),
			icon: Pencil,
			shortcut: "F2",
			onSelect: () => actions.requestRename(folder),
		},
		{
			kind: "sub",
			label: t("folder.move"),
			icon: FolderInput,
			emptyLabel: t("folder.moveEmpty"),
			items: [
				...(folder.parentId
					? [
							{
								kind: "item" as const,
								label: t("folder.root"),
								icon: FolderUp,
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
			label: t("common.delete"),
			icon: Trash2,
			shortcut: "Del",
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
	const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
	const [name, setName] = useState("");
	const [deleteDialog, setDeleteDialog] = useState<DeleteDialog | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
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

	const requestDelete = async (folder: Folder) => {
		rememberFocus();
		setError(null);
		setDeleteDialog({ folder, contents: null });
		try {
			const contents = await cmsFetch<DeleteDialog["contents"]>(site, cmsApiUrl(`/v1/folders/${folder.id}`));
			setDeleteDialog({ folder, contents });
		} catch (err) {
			setError(errorText(site, err, t("folder.loadFailed")));
		}
	};

	/** Moves a folder to another parent (or the top level). If the same name exists, the server rejects and explains. */
	const moveFolder = async (folder: Folder, parentId: string | null) => {
		try {
			await cmsFetch(site, cmsApiUrl(`/v1/folders/${folder.id}`), {
				method: "PATCH",
				json: { parentId, expectedVersion: folder.version },
				fallback: t("folder.moveFailed"),
			});
			toast.success(t("folder.moved", { name: folder.name, destination: toFolder(parentId) }));
			await onChanged();
		} catch (err) {
			toast.error(errorText(site, err, t("folder.moveFailed")));
		}
	};

	const submitName = async () => {
		if (!nameDialog || !name.trim()) return;
		setIsBusy(true);
		setError(null);
		try {
			if (nameDialog.mode === "create") {
				await cmsFetch(site, cmsApiUrl("/v1/folders"), {
					method: "POST",
					json: { collection, name: name.trim(), parentId: nameDialog.parentId },
					fallback: t("folder.addFailed"),
				});
				toast.success(t("folder.added", { name: name.trim() }));
			} else {
				await cmsFetch(site, cmsApiUrl(`/v1/folders/${nameDialog.folder.id}`), {
					method: "PATCH",
					json: { name: name.trim(), expectedVersion: nameDialog.folder.version },
					fallback: t("folder.renameFailed"),
				});
				toast.success(t("folder.saved"));
			}
			setNameDialog(null);
			await onChanged();
		} catch (err) {
			setError(errorText(site, err, t("folder.saveFailed")));
		} finally {
			setIsBusy(false);
		}
	};

	const confirmDelete = async () => {
		if (!deleteDialog) return;
		setIsBusy(true);
		setError(null);
		try {
			await cmsFetch(
				site,
				cmsApiUrl(`/v1/folders/${deleteDialog.folder.id}?expectedVersion=${deleteDialog.folder.version}`),
				{
					method: "DELETE",
					fallback: t("folder.deleteFailed"),
				},
			);
			const deletedId = deleteDialog.folder.id;
			const moved = deleteDialog.contents;
			toast.success(
				moved && moved.entryCount + moved.childFolders.length > 0
					? t("folder.deletedMoved", {
							name: deleteDialog.folder.name,
							destination: toFolder(deleteDialog.folder.parentId),
						})
					: t("folder.deleted", { name: deleteDialog.folder.name }),
			);
			setDeleteDialog(null);
			await onChanged(deletedId);
		} catch (err) {
			// If a child folder name collides in the parent, guide the user to rename first.
			setError(errorText(site, err, t("folder.deleteFailed")));
		} finally {
			setIsBusy(false);
		}
	};

	const destination = deleteDialog ? toFolder(deleteDialog.folder.parentId) : "";

	const dialogs = (
		<>
			<Dialog open={nameDialog !== null} onOpenChange={(open) => !open && setNameDialog(null)}>
				<DialogContent className="max-w-sm" finalFocus={restoreFocus}>
					<DialogHeader>
						<DialogTitle>
							{nameDialog?.mode === "rename"
								? t("folder.renameTitle")
								: nameDialog?.parentId
									? t("folder.addChild")
									: t("folder.add")}
						</DialogTitle>
						<DialogDescription>
							{nameDialog?.mode === "create"
								? t("folder.location", { name: folderName(nameDialog.parentId) })
								: t("folder.uniqueName")}
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void submitName();
						}}
						className="space-y-4"
					>
						<Field data-invalid={Boolean(error) || undefined}>
							<FieldLabel htmlFor="folder-name" className="sr-only">
								{t("folder.nameLabel")}
							</FieldLabel>
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
							{error && <FieldError>{error}</FieldError>}
						</Field>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setNameDialog(null)}>
								{t("common.cancel")}
							</Button>
							<Button type="submit" disabled={!name.trim() || isBusy}>
								{isBusy ? t("common.saving") : t("common.save")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
				<AlertDialogContent finalFocus={restoreFocus}>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("folder.deleteTitle", { name: deleteDialog?.folder.name ?? "" })}</AlertDialogTitle>
						<AlertDialogDescription>{t("folder.deleteAsk", { itemLabel, destination })}</AlertDialogDescription>
					</AlertDialogHeader>
					{deleteDialog?.contents ? (
						<ul className="list-disc space-y-1 pl-5 text-sm">
							<li>{t("folder.entryCount", { itemLabel, count: deleteDialog.contents.entryCount })}</li>
							<li>
								{t("folder.childCount", { count: deleteDialog.contents.childFolders.length })}
								{deleteDialog.contents.childFolders.length > 0 &&
									`: ${deleteDialog.contents.childFolders.map((folder) => folder.name).join(", ")}`}
							</li>
						</ul>
					) : (
						!error && (
							<div aria-hidden className="space-y-2">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-4 w-56" />
							</div>
						)
					)}
					{error && (
						<p role="alert" className="text-cms-destructive text-sm">
							{error}
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel type="button">{t("common.cancel")}</AlertDialogCancel>
						<Button
							type="button"
							variant="destructive"
							disabled={!deleteDialog?.contents || isBusy}
							onClick={() => void confirmDelete()}
						>
							{isBusy ? t("common.deleting") : t("common.delete")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);

	return { requestCreate, requestRename, requestDelete, moveFolder, dialogs };
}

export type FolderActions = Pick<
	ReturnType<typeof useFolderActions>,
	"requestCreate" | "requestRename" | "requestDelete" | "moveFolder"
>;
