import {
	Archive,
	Copy,
	Edit,
	Folder as FolderIcon,
	FolderMoveTo,
	FolderParent,
	Launch,
	Reset,
	RightPanelOpen,
	Tag,
	TagGroup,
	TrashCan,
} from "@carbon/icons-react";
import type { BulkOp, Folder, ListEntriesItem, Site } from "@monti-cms/core/site";
import type { BulkParams, BulkSelection } from "../api/entries";
import { commonMessages } from "../lib/common.messages";
import { screensMessages } from "./messages";
import type { MenuAction } from "./shared/action-menu";
import type { TaxonomyOptions } from "./shared/use-taxonomy";

export const toSelection = (item: ListEntriesItem): BulkSelection => ({
	id: item.id,
	expectedVersion: item.version,
	title: item.title,
	status: item.status,
});

/** The ids each relation field holds across these rows (the tags any of them has), for the menus that take one away. */
export function heldRelations(items: readonly ListEntriesItem[]): Record<string, Set<string>> {
	const held: Record<string, Set<string>> = {};
	for (const item of items)
		for (const [field, values] of Object.entries(item.relations)) {
			held[field] ??= new Set();
			for (const value of values) held[field].add(value.id);
		}
	return held;
}

/**
 * Target of right-click / Delete key. If the pressed row is one of the selected rows and two or more are selected, all selected rows; otherwise just that row.
 */
export function actionTargets(
	item: ListEntriesItem,
	items: readonly ListEntriesItem[],
	selectedIds: ReadonlySet<string>,
): ListEntriesItem[] {
	return selectedIds.has(item.id) && selectedIds.size > 1 ? items.filter((row) => selectedIds.has(row.id)) : [item];
}

export interface RowMenuContext {
	mode: "list" | "trash";
	/** Collections opened as a small form, like tags, categories and series. */
	isRecord: boolean;
	/** Collections that can be archived (documents). */
	isContent: boolean;
	/** The folders rows can move to; `null` where the list shows no folders (a collection without folders, the trash), which leaves out "Move to folder". */
	folders: readonly Folder[] | null;
	collection: string;
	/** Taxonomy field name -> options. Makes an "Add ○○" submenu for each many-relation taxonomy field (tags etc.). */
	options: TaxonomyOptions;
}

/** Action a menu item calls. The target is always the rows chosen by `actionTargets`. */
export interface RowMenuHandlers {
	openEditor: (item: ListEntriesItem) => void;
	openInNewTab: (item: ListEntriesItem) => void;
	openRecord: (item: ListEntriesItem) => void;
	duplicate: (item: ListEntriesItem) => void;
	restore: (targets: BulkSelection[]) => void;
	confirmTrash: (targets: BulkSelection[]) => void;
	/** Archiving takes down a public post, so it asks first (for one or many). */
	confirmArchive: (targets: BulkSelection[]) => void;
	confirmPermanentDelete: (targets: BulkSelection[]) => void;
	bulk: (op: BulkOp, label: string, targets: BulkSelection[], params?: BulkParams) => void;
}

/** Row menu. One row gets open and duplicate; several rows get the item count at the top. Trash has only restore and permanent delete. */
export function rowMenuActions(
	site: Site,
	group: readonly ListEntriesItem[],
	context: RowMenuContext,
	handlers: RowMenuHandlers,
): MenuAction[] {
	const t = site.createTranslator(screensMessages);
	const tc = site.createTranslator(commonMessages);
	const targets = group.map(toSelection);
	const single = group.length === 1 ? group[0] : undefined;
	const header: MenuAction[] = single ? [] : [{ kind: "label", label: t("menu.items", { count: group.length }) }];

	if (context.mode === "trash") {
		return [
			...header,
			{ kind: "item", label: tc("lifecycle.restore"), icon: Reset, onSelect: () => handlers.restore(targets) },
			{ kind: "separator" },
			{
				kind: "item",
				label: tc("lifecycle.deletePermanently"),
				icon: TrashCan,
				shortcut: "Del",
				destructive: true,
				onSelect: () => handlers.confirmPermanentDelete(targets),
			},
		];
	}

	const open: MenuAction[] = !single
		? []
		: context.isRecord
			? [{ kind: "item", label: tc("open"), icon: RightPanelOpen, onSelect: () => handlers.openRecord(single) }]
			: [
					{ kind: "item", label: tc("open"), icon: Edit, onSelect: () => handlers.openEditor(single) },
					{
						kind: "item",
						label: t("menu.openNewTab"),
						icon: Launch,
						onSelect: () => handlers.openInNewTab(single),
					},
					{ kind: "item", label: tc("lifecycle.duplicate"), icon: Copy, onSelect: () => handlers.duplicate(single) },
				];
	const allArchived = group.every((row) => row.status === "archived");
	const addActions: MenuAction[] = site.taxonomyFieldsOf(context.collection).flatMap((stored): MenuAction[] => {
		if (stored.field.kind !== "relation" || !stored.field.many) return [];
		const label = stored.field.label;
		return [
			{
				kind: "sub",
				label: t("menu.addRelation", { label }),
				icon: TagGroup,
				emptyLabel: t("menu.relationEmpty", { label }),
				items: (context.options[stored.name] ?? []).map((option) => ({
					kind: "item" as const,
					label: option.title,
					icon: Tag,
					onSelect: () =>
						handlers.bulk("relation.add", t("bulk.addRelation", { label }), targets, {
							field: stored.name,
							ids: [option.id],
						}),
				})),
			},
		];
	});
	const contentActions: MenuAction[] = context.isContent
		? [
				...addActions,
				{ kind: "separator" },
				allArchived
					? {
							kind: "item",
							label: tc("lifecycle.unarchive"),
							icon: Archive,
							onSelect: () => handlers.bulk("unarchive", tc("lifecycle.unarchive"), targets),
						}
					: {
							kind: "item",
							label: tc("lifecycle.archive"),
							icon: Archive,
							onSelect: () => handlers.confirmArchive(targets),
						},
			]
		: [{ kind: "separator" }];

	const folderActions: MenuAction[] =
		context.folders === null
			? []
			: [
					{
						kind: "sub",
						label: t("menu.moveToFolder"),
						icon: FolderMoveTo,
						items: [
							{
								kind: "item",
								label: t("menu.root"),
								icon: FolderParent,
								onSelect: () => handlers.bulk("folder.move", t("bulk.move"), targets, { folderId: null }),
							},
							...context.folders.map((folder) => ({
								kind: "item" as const,
								label: folder.name,
								icon: FolderIcon,
								onSelect: () => handlers.bulk("folder.move", t("bulk.move"), targets, { folderId: folder.id }),
							})),
						],
					},
				];

	return [
		...header,
		...open,
		...(folderActions.length > 0 ? [{ kind: "separator" as const }, ...folderActions] : []),
		...contentActions,
		{
			kind: "item",
			label: tc("lifecycle.trash"),
			icon: TrashCan,
			shortcut: "Del",
			destructive: true,
			onSelect: () => handlers.confirmTrash(targets),
		},
	];
}
