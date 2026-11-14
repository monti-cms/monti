import type { ListColumn, ListRow, RelationOptionsResult } from "@monti-cms/core";
import {
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSearch,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	MenuShortcut,
	toast,
} from "@monti-cms/ui";
import { Tag } from "@monti-cms/ui/icons";
import { useState } from "react";
import { useUndo } from "../../activity/use-undo";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { endsClosed } from "./format";

/** The radio values of "none" and of rows that hold different values: no group id looks like these. */
const NONE = "\u0000none";
const MIXED = "\u0000mixed";

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
	const read = useRead<RelationOptionsResult>("relations.options", { collection, field: fieldName });
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

	/** Says the change with the activity log's undo, or why it did not go through (status.md: a failed write says so). */
	const told = (res: Awaited<ReturnType<typeof editOp.run>>) => {
		if (!res.ok) {
			toast.error(t(reasonOf(res.refusal)));
			return false;
		}
		const count = res.body.output?.count ?? rows.length;
		const activity = res.body.activityId;
		toast(t("relations.edited", { count, fieldObject }), {
			action: activity ? { label: t("common.undo"), onClick: () => void undo.run(activity) } : undefined,
		});
		return true;
	};

	/** One value for every row, or none (`null`). */
	const handleSet = async (val: string | null) => {
		if (told(await editOp.run({ collection, entryIds, field: fieldName, set: val }))) onDone?.();
	};

	const handleToggle = async (group: string, isAllSelected: boolean) => {
		told(
			await editOp.run({
				collection,
				entryIds,
				field: fieldName,
				...(isAllSelected ? { remove: [group] } : { add: [group] }),
			}),
		);
	};

	const allNone = rows.length > 0 && rows.every(isEmpty);
	/** The value every row holds; with rows that differ, none is ticked. */
	const current = allNone
		? NONE
		: (options.find((opt) => rows.length > 0 && rows.every((r) => hasGroup(r, opt.group)))?.group ?? MIXED);

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
		// One value: the rows' shared value has its ✓, and picking it again changes nothing (menu.md). A required field offers no "none".
		<DropdownMenuRadioGroup
			value={current}
			onValueChange={(value: string) => {
				if (value !== current) void handleSet(value === NONE ? null : value);
			}}
		>
			{!column.required && <DropdownMenuRadioItem value={NONE}>{t("list.relationNone")}</DropdownMenuRadioItem>}
			{options.map((opt) => (
				<DropdownMenuRadioItem key={opt.group} value={opt.group}>
					{opt.title}
				</DropdownMenuRadioItem>
			))}
		</DropdownMenuRadioGroup>
	);

	if (context) {
		return (
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					{icon && <Tag aria-hidden />}
					{fieldLabel}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>{menuItems}</ContextMenuSubContent>
			</ContextMenuSub>
		);
	}

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				{icon && <Tag aria-hidden />}
				{fieldLabel}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent>{menuItems}</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
