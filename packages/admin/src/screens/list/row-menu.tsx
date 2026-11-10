import type { ListRow } from "@monti-cms/core";
import {
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	DropdownMenuItem,
	DropdownMenuSeparator,
	MenuShortcut,
} from "@monti-cms/ui";
import { Archive, Copy, Launch, TrashCan } from "@monti-cms/ui/icons";
import type { ReactNode } from "react";
import { useAdmin } from "../../operations/admin-context";

/** What a row's menu does; the list wires each to an operation of doc 02 (doc 06, principle 5: the list has no write of its own). */
export type RowActions = {
	open: (row: ListRow) => void;
	openNewTab: (row: ListRow) => void;
	duplicate: (row: ListRow) => void;
	archive: (rows: ListRow[]) => void;
	unarchive: (rows: ListRow[]) => void;
	publish: (rows: ListRow[]) => void;
	exportRows: (rows: ListRow[]) => void;
	/** To the trash (doc 11): it asks first when a published entry goes off the site. */
	trash: (rows: ListRow[]) => void;
};

/** Only drafts and entries edited since publishing have something to publish (components/list.md, bulk bar). */
export const publishable = (rows: ListRow[]) => rows.filter((row) => row.state === "draft" || row.state === "changed");
export const allArchived = (rows: ListRow[]) => rows.length > 0 && rows.every((row) => row.state === "archived");

/**
 * One row's menu, the same from its ⋯ and from a right click: open, open in a new tab, duplicate | to a folder, relations | archive | to the trash
 * (flow 5·07). A right click shows the key that does the same on the row.
 */
export function RowMenuItems({
	row,
	actions,
	context,
	document,
	toFolder,
	relations,
}: {
	row: ListRow;
	actions: RowActions;
	context: boolean;
	/** A document collection; an item one (tags) has no archive (components/list.md, bulk bar). */
	document: boolean;
	/** The "to folder ▸" submenu, when the collection uses folders (doc 07). */
	toFolder?: ReactNode;
	/** Relation submenus for category, tags, etc. (doc 08, T55). */
	relations?: ReactNode;
}) {
	const { t } = useAdmin();
	const Item = context ? ContextMenuItem : DropdownMenuItem;
	const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
	return (
		<>
			<Item onClick={() => actions.open(row)}>
				<Launch aria-hidden />
				{t("list.open")}
			</Item>
			<Item onClick={() => actions.openNewTab(row)}>
				<Launch aria-hidden />
				{t("list.openNewTab")}
			</Item>
			<Item onClick={() => actions.duplicate(row)}>
				<Copy aria-hidden />
				{t("list.duplicate")}
			</Item>
			{(toFolder || relations) && <Separator />}
			{toFolder}
			{relations}
			{document && <Separator />}
			{!document ? null : row.state === "archived" ? (
				<Item onClick={() => actions.unarchive([row])}>
					<Archive aria-hidden />
					{t("list.unarchive")}
				</Item>
			) : (
				<Item onClick={() => actions.archive([row])}>
					<Archive aria-hidden />
					{t("list.archive")}
				</Item>
			)}
			{/* With "Archive" where there is one: what takes a row out of the list (screens/list.md, right click). */}
			{!document && <Separator />}
			<Item variant="danger" onClick={() => actions.trash([row])}>
				<TrashCan aria-hidden />
				{t("trash.toTrash")}
				{context && <MenuShortcut>Del</MenuShortcut>}
			</Item>
		</>
	);
}

/** The menu of a right click on picked rows: what the bulk bar does, by the same names, without icons (screens/list.md, right click on several rows). */
export function RowsMenuItems({
	rows,
	actions,
	document,
	toFolder,
	relations,
}: {
	rows: ListRow[];
	actions: RowActions;
	document: boolean;
	toFolder?: ReactNode;
	/** Relation submenus for category, tags, etc. (doc 08, T55). */
	relations?: ReactNode;
}) {
	const { t } = useAdmin();
	return (
		<>
			<ContextMenuGroup>
				<ContextMenuLabel>{t("list.items", { count: rows.length })}</ContextMenuLabel>
			</ContextMenuGroup>
			{document && publishable(rows).length > 0 && (
				<ContextMenuItem onClick={() => actions.publish(rows)}>{t("list.publish")}</ContextMenuItem>
			)}
			{!document ? null : allArchived(rows) ? (
				<ContextMenuItem onClick={() => actions.unarchive(rows)}>{t("list.unarchive")}</ContextMenuItem>
			) : (
				<ContextMenuItem onClick={() => actions.archive(rows)}>{t("list.archive")}</ContextMenuItem>
			)}
			{toFolder}
			{relations}
			{document && <ContextMenuSeparator />}
			<ContextMenuItem onClick={() => actions.exportRows(rows)}>{t("list.export")}</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem variant="danger" onClick={() => actions.trash(rows)}>
				{t("trash.toTrash")}
				<MenuShortcut>Del</MenuShortcut>
			</ContextMenuItem>
		</>
	);
}
