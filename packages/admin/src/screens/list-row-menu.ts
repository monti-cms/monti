import {
	Archive,
	Copy,
	Edit,
	Export,
	Folder as FolderIcon,
	FolderMoveTo,
	FolderParent,
	Launch,
	RightPanelOpen,
	Tag,
	TrashCan,
	Upload,
} from "@carbon/icons-react";
import type { BulkOp, Folder, ListEntriesItem, Site } from "@monti-cms/core/site";
import { createElement } from "react";
import type { BulkParams, BulkSelection } from "../api/entries";
import { commonMessages } from "../lib/common.messages";
import { archiveAction, canPublish, changeableRelations, toSelection } from "./entries/bulk-model";
import { RelationChoice } from "./entries/relation-choice";
import { exportMessages } from "./export/messages";
import { screensMessages } from "./messages";
import type { MenuAction } from "./shared/action-menu";

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
	/** Collections opened as a small form, like tags, categories and series. */
	isRecord: boolean;
	/** Collections that can be archived (documents). */
	isContent: boolean;
	/** The folders rows can move to; `null` where the list shows no folders (a collection without folders), which leaves out "Move to folder". */
	folders: readonly Folder[] | null;
	collection: string;
}

/** Action a menu item calls. The target is always the rows chosen by `actionTargets`. */
export interface RowMenuHandlers {
	openEditor: (item: ListEntriesItem) => void;
	openInNewTab: (item: ListEntriesItem) => void;
	openRecord: (item: ListEntriesItem) => void;
	duplicate: (item: ListEntriesItem) => void;
	/** Publishing several entries asks first. */
	confirmPublish: (targets: BulkSelection[]) => void;
	/** Opens the export of these entries. */
	exportEntries: (ids: string[]) => void;
	confirmTrash: (targets: BulkSelection[]) => void;
	/** Archiving takes down a public post, so it asks first (for one or many). */
	confirmArchive: (targets: BulkSelection[]) => void;
	bulk: (op: BulkOp, label: string, targets: BulkSelection[], params?: BulkParams) => void;
}

/**
 * Row menu. One row: open, new tab and duplicate; then the folder and each relation field (a second level of boxes or a single choice, the bar's Change menu
 * lists); then archive and the trash. Several rows get the item count at the top, then what can be done to all of them: publish (when something is left to
 * publish), archive, the folder, the relation fields, export and, last, the trash.
 */
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
	// Each relation field the entries have is a second level: boxes to tick (for one row just ✓ or empty) or a single choice, as the bar's Change menu shows.
	const relationActions: MenuAction[] = changeableRelations(site, context.collection).map((field) => ({
		kind: "choice",
		label: field.label,
		icon: Tag,
		content: createElement(RelationChoice, { field, rows: group, onRun: handlers.bulk }),
	}));
	const open: MenuAction[] = single
		? context.isRecord
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
				]
		: [];
	const publish: MenuAction[] =
		!single && context.isContent && canPublish(group)
			? [
					{
						kind: "item",
						label: tc("lifecycle.publish"),
						icon: Upload,
						onSelect: () => handlers.confirmPublish(targets),
					},
				]
			: [];
	const archive: MenuAction[] = !context.isContent
		? []
		: [
				archiveAction(group) === "unarchive"
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
			];
	const trash: MenuAction = {
		kind: "item",
		label: tc("lifecycle.trash"),
		icon: TrashCan,
		shortcut: "Del",
		destructive: true,
		onSelect: () => handlers.confirmTrash(targets),
	};
	// One row: open, then the folder and the fields, then archive and the trash. Several rows: what the bar offers, as rows of the same names.
	if (single) {
		return [
			...open,
			{ kind: "separator" },
			...folderActions,
			...relationActions,
			{ kind: "separator" },
			...archive,
			trash,
		];
	}
	return [
		...header,
		...publish,
		...archive,
		...folderActions,
		...relationActions,
		{ kind: "separator" },
		{
			kind: "item",
			label: site.createTranslator(exportMessages)("action.selected"),
			icon: Export,
			onSelect: () => handlers.exportEntries(group.map((row) => row.id)),
		},
		{ kind: "separator" },
		trash,
	];
}
