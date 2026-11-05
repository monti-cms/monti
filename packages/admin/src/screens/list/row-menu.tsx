import type { ListRow } from "@monti-cms/core";
import {
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@monti-cms/ui";
import { Archive, Copy, Launch } from "@monti-cms/ui/icons";
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
};

/** Only drafts and entries edited since publishing have something to publish (components/list.md, bulk bar). */
export const publishable = (rows: ListRow[]) => rows.filter((row) => row.state === "draft" || row.state === "changed");
export const allArchived = (rows: ListRow[]) => rows.length > 0 && rows.every((row) => row.state === "archived");

/**
 * One row's menu, the same from its ⋯ and from a right click: open, open in a new tab, duplicate | archive. The rows of docs 07, 08 and 11 (to a
 * folder, category, tag, to the trash) join with those docs (T54–T56).
 */
export function RowMenuItems({
	row,
	actions,
	context,
	document,
}: {
	row: ListRow;
	actions: RowActions;
	context: boolean;
	/** A document collection; an item one (tags) has no archive (components/list.md, bulk bar). */
	document: boolean;
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
		</>
	);
}

/** The menu of a right click on picked rows: what the bulk bar does, by the same names, without icons (screens/list.md, right click on several rows). */
export function RowsMenuItems({
	rows,
	actions,
	document,
}: {
	rows: ListRow[];
	actions: RowActions;
	document: boolean;
}) {
	const { t } = useAdmin();
	return (
		<>
			<ContextMenuLabel>{t("list.items", { count: rows.length })}</ContextMenuLabel>
			{document && publishable(rows).length > 0 && (
				<ContextMenuItem onClick={() => actions.publish(rows)}>{t("list.publish")}</ContextMenuItem>
			)}
			{!document ? null : allArchived(rows) ? (
				<ContextMenuItem onClick={() => actions.unarchive(rows)}>{t("list.unarchive")}</ContextMenuItem>
			) : (
				<ContextMenuItem onClick={() => actions.archive(rows)}>{t("list.archive")}</ContextMenuItem>
			)}
			{document && <ContextMenuSeparator />}
			<ContextMenuItem onClick={() => actions.exportRows(rows)}>{t("list.export")}</ContextMenuItem>
		</>
	);
}
