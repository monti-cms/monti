import type { ListColumn, ListRow, RelationOptionsResult } from "@monti-cms/core";
import {
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSearch,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	MenuShortcut,
	MenuTick,
	toast,
} from "@monti-cms/ui";
import { Tag } from "@monti-cms/ui/icons";
import { useState } from "react";
import { useUndo } from "../../activity/use-undo";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { endsClosed } from "./format";

export type RelationSubmenuProps = {
	collection: string;
	column: ListColumn;
	rows: ListRow[];
	context: boolean;
	icon?: boolean;
	onDone?: () => void;
};

/**
 * Submenu for editing a relation field across one or more rows (doc 08, T55).
 * Supports both context menus and dropdown menus (BulkBar / row menu).
 */
export function RelationSubmenu({ collection, column, rows, context, icon = false, onDone }: RelationSubmenuProps) {
	const { t } = useAdmin();
	const [find, setFind] = useState("");
	const fieldName = column.field ?? column.id;
	const read = useRead<RelationOptionsResult>(
		"relations.options",
		{ collection, field: fieldName },
		{ afterWrites: true },
	);
	const editOp = useOperation<{
		output: { updatedGroups: string[]; count: number };
		activityId?: string;
	}>("relations.edit");
	const undo = useUndo();

	const options = read.data?.options ?? [];
	const filteredOptions = find.trim()
		? options.filter((o) => o.title.toLowerCase().includes(find.trim().toLowerCase()))
		: options;
	const entryIds = rows.map((r) => r.id);
	const fieldLabel = column.label ?? fieldName;
	const fieldObject = t(endsClosed(fieldLabel) ? "list.objectFinal" : "list.objectOpen", { name: fieldLabel });

	const hasGroup = (r: ListRow, group: string) => {
		const rels = r.relations?.[fieldName];
		if (rels) return rels.some((rel) => rel.id === group);
		const v = r.values[fieldName];
		return Array.isArray(v) ? v.includes(group) : v === group;
	};

	const isEmpty = (r: ListRow) => {
		const rels = r.relations?.[fieldName];
		if (rels) return rels.length === 0;
		const v = r.values[fieldName];
		return Array.isArray(v) ? v.length === 0 : !v;
	};

	const handleSet = async (val: string | null, isCurrentlySelected: boolean) => {
		const targetVal = isCurrentlySelected ? null : val;
		const res = await editOp.run({
			collection,
			entryIds,
			field: fieldName,
			set: targetVal,
		});
		if (res.ok) {
			const count = res.body.output?.count ?? rows.length;
			toast(t("relations.edited", { count, fieldObject }), {
				action: res.body.activityId
					? {
							label: t("common.undo"),
							onClick: () => void (res.body.activityId && undo.run(res.body.activityId)),
						}
					: undefined,
			});
			onDone?.();
		}
	};

	const handleToggle = async (group: string, isAllSelected: boolean) => {
		const res = isAllSelected
			? await editOp.run({
					collection,
					entryIds,
					field: fieldName,
					remove: [group],
				})
			: await editOp.run({
					collection,
					entryIds,
					field: fieldName,
					add: [group],
				});
		if (res.ok) {
			const count = res.body.output?.count ?? rows.length;
			toast(t("relations.edited", { count, fieldObject }), {
				action: res.body.activityId
					? {
							label: t("common.undo"),
							onClick: () => void (res.body.activityId && undo.run(res.body.activityId)),
						}
					: undefined,
			});
		}
	};

	const allNone = rows.length > 0 && rows.every(isEmpty);

	const menuItems = column.many ? (
		<>
			<DropdownMenuSearch value={find} onValueChange={setFind} label={t("list.findValue")} />
			{filteredOptions.map((opt) => {
				const matching = rows.filter((r) => hasGroup(r, opt.group)).length;
				const all = rows.length > 0 && matching === rows.length;
				const some = matching > 0 && !all;
				return (
					<DropdownMenuCheckboxItem
						key={opt.group}
						box
						checked={all}
						mixed={some}
						closeOnClick={false}
						onCheckedChange={() => void handleToggle(opt.group, all)}
					>
						{opt.title}
						{some && <MenuShortcut>{`${matching}/${rows.length}`}</MenuShortcut>}
					</DropdownMenuCheckboxItem>
				);
			})}
		</>
	) : (
		<>
			{context ? (
				<ContextMenuItem onClick={() => void handleSet(null, allNone)}>
					{t("list.relationNone")}
					{allNone && <MenuTick />}
				</ContextMenuItem>
			) : (
				<DropdownMenuItem onClick={() => void handleSet(null, allNone)}>
					{t("list.relationNone")}
					{allNone && <MenuTick />}
				</DropdownMenuItem>
			)}
			{options.map((opt) => {
				const all = rows.length > 0 && rows.every((r) => hasGroup(r, opt.group));
				if (context) {
					return (
						<ContextMenuItem key={opt.group} onClick={() => void handleSet(opt.group, all)}>
							{opt.title}
							{all && <MenuTick />}
						</ContextMenuItem>
					);
				}
				return (
					<DropdownMenuItem key={opt.group} onClick={() => void handleSet(opt.group, all)}>
						{opt.title}
						{all && <MenuTick />}
					</DropdownMenuItem>
				);
			})}
		</>
	);

	if (context) {
		return (
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					{icon && <Tag aria-hidden />}
					{fieldLabel}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					{column.many ? menuItems : <ContextMenuGroup>{menuItems}</ContextMenuGroup>}
				</ContextMenuSubContent>
			</ContextMenuSub>
		);
	}

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				{icon && <Tag aria-hidden />}
				{fieldLabel}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>
				{column.many ? menuItems : <DropdownMenuGroup>{menuItems}</DropdownMenuGroup>}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
