import type { FolderNode } from "@monti-cms/core";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	MenuTick,
	toast,
} from "@monti-cms/ui";
import { Edit, Folder, Launch, TrashCan } from "@monti-cms/ui/icons";
import { useMemo, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";

/** A collection's folders (doc 07): the tree in order, and the ways to read it. */
export type Folders = {
	list: FolderNode[];
	byId: Map<string, FolderNode>;
	/** The folder's ancestors, top first, then the folder itself. */
	path: (id: string) => FolderNode[];
	/** The folders right inside one (`null`: the top level). */
	children: (id: string | null) => FolderNode[];
};

/** The folders of a collection, read again after every write (a move changes the counts). Off when the collection does not use folders. */
export function useFolders(collection: string, on: boolean): Folders {
	const read = useRead<{ folders: FolderNode[] }>(
		"folders.tree",
		{ scope: { collection } },
		{ afterWrites: true, skip: !on },
	);
	return useMemo(() => {
		const list = on ? (read.data?.folders ?? []) : [];
		const byId = new Map(list.map((folder) => [folder.id, folder]));
		const path = (id: string) => {
			const chain: FolderNode[] = [];
			for (let at = byId.get(id); at; at = at.parentId === null ? undefined : byId.get(at.parentId)) chain.unshift(at);
			return chain;
		};
		return { list, byId, path, children: (id) => list.filter((folder) => folder.parentId === id) };
	}, [on, read.data]);
}

/** A folder's name with the folders above it, for a menu where nested names would read alike: "Series / drafts". */
export const folderPath = (folders: Folders, id: string) =>
	folders
		.path(id)
		.map((folder) => folder.name)
		.join(" / ");

/**
 * "To folder ▸" (screens/list.md, row menus): the top level and every folder, the current place ticked. In a right-click menu or a ⋯ menu; `except`
 * leaves out a folder and what is under it (a folder cannot go inside itself).
 */
export function MoveToFolderMenu({
	context,
	label,
	folders,
	current,
	except,
	onPick,
}: {
	context: boolean;
	label: string;
	folders: Folders;
	current: string | null | undefined;
	except?: string;
	onPick: (folder: string | null) => void;
}) {
	const { t } = useAdmin();
	const Sub = context ? ContextMenuSub : DropdownMenuSub;
	const Trigger = context ? ContextMenuSubTrigger : DropdownMenuSubTrigger;
	const Content = context ? ContextMenuSubContent : DropdownMenuSubContent;
	const Item = context ? ContextMenuItem : DropdownMenuItem;
	const shown = folders.list.filter((folder) => !except || !folders.path(folder.id).some((up) => up.id === except));
	return (
		<Sub>
			<Trigger>
				<Folder aria-hidden />
				{label}
			</Trigger>
			<Content>
				<Item onClick={() => onPick(null)}>
					{t("folders.top")}
					{current === null && <MenuTick />}
				</Item>
				{shown.map((folder) => (
					<Item key={folder.id} onClick={() => onPick(folder.id)}>
						{folderPath(folders, folder.id)}
						{current === folder.id && <MenuTick />}
					</Item>
				))}
			</Content>
		</Sub>
	);
}

/** A folder row's menu, from a right click or its ⋯ (flow 5·04): open, rename, move ▸ | remove. */
export function FolderMenuItems({
	context,
	folder,
	folders,
	onOpen,
	onRename,
	onMove,
	onRemove,
}: {
	context: boolean;
	folder: FolderNode;
	folders: Folders;
	onOpen: () => void;
	onRename: () => void;
	onMove: (parent: string | null) => void;
	onRemove: () => void;
}) {
	const { t } = useAdmin();
	const Item = context ? ContextMenuItem : DropdownMenuItem;
	const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
	return (
		<>
			<Item onClick={onOpen}>
				<Launch aria-hidden />
				{t("list.open")}
			</Item>
			<Item onClick={onRename}>
				<Edit aria-hidden />
				{t("folders.rename")}
			</Item>
			<MoveToFolderMenu
				context={context}
				label={t("folders.move")}
				folders={folders}
				current={folder.parentId}
				except={folder.id}
				onPick={onMove}
			/>
			<Separator />
			<Item variant="danger" onClick={onRemove}>
				<TrashCan aria-hidden />
				{t("folders.remove")}
			</Item>
		</>
	);
}

/**
 * Removing a folder (doc 07, flow 5·05–06): a folder with published entries asks first, saying how many go off the site; a folder of drafts goes
 * at once. Either way the toast takes it back.
 */
export function useRemoveFolder() {
	const { t } = useAdmin();
	const remove = useOperation<{ activityId: string }>("folders.remove");
	const undo = useOperation("activity.undo");
	const [asking, setAsking] = useState<FolderNode | null>(null);
	const run = async (folder: FolderNode) => {
		setAsking(null);
		const result = await remove.run({ id: folder.id });
		if (!result.ok) return void toast.error(t(result.refusal.reason ?? "errors.unexpected"));
		const { activityId } = result.body;
		toast(t("folders.removed", { name: folder.name }), {
			action: { label: t("folders.undo"), onClick: () => void undo.run({ id: activityId }) },
		});
	};
	const start = (folder: FolderNode) => (folder.published > 0 ? setAsking(folder) : void run(folder));
	const dialog = (
		<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("folders.removeTitle", { name: asking?.name ?? "" })}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("folders.removeText", { count: asking?.count ?? 0, published: asking?.published ?? 0 })}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("folders.cancel")}</AlertDialogCancel>
					<AlertDialogAction variant="danger" onClick={() => asking && void run(asking)}>
						{t("folders.toTrash")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
	return { start, dialog };
}
