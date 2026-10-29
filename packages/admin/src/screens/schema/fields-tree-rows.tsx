"use client";

// The rows of the fields tree: a field row (with the branches of a conditional field), its icon buttons and move dialog.
// Dragging itself lives in fields-tree-dnd.tsx; the tab and group rows of the layout in fields-tree-layout-rows.tsx.

import { ArrowRight, type ArrowUp, TrashCan, Undo } from "@carbon/icons-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslator } from "@monti-cms/core/site";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, FieldRow, IconButton, Stack } from "@monti-cms/ui";
import { useState } from "react";
import { schemaChangesMessages } from "./changes.messages";
import { useIssuesUnder, useSchemaEdit } from "./controls";
import type { CollectionEditing } from "./field-editor";
import type { FieldMark } from "./field-marks";
import { branchFields, summarizeField } from "./field-summary";
import { schemaFieldsMessages } from "./fields.messages";
import { SortableList } from "./fields-tree-dnd";
import { schemaMessages } from "./messages";
import { schemaProblemMessages } from "./problems.messages";
import {
	collectionsOf,
	type FieldPlace,
	fieldAt,
	type Obj,
	optionsOf,
	removeBlock,
	removeField,
	reorderField,
	sameJson,
	setField,
} from "./schema-model";

export interface TreeContext {
	readonly editing: CollectionEditing;
	readonly onOpen: (place: FieldPlace, name: string) => void;
	/** How each field differs from the saved file, by its name. */
	readonly marks: Readonly<Record<string, FieldMark>>;
}

/** Why a top-level row cannot be moved or grouped. */
export type Locked = { readonly kind: "plugin"; readonly tab: string } | { readonly kind: "panel" };

/** A place a row can be moved to from the move dialog (the keyboard and touch alternative to dragging). */
export interface Destination {
	readonly label: string;
	readonly disabled?: boolean;
	readonly run: () => void;
}

/** One icon button of a row: shown on hover and while focus is inside the row, without moving anything. */
export interface RowButton {
	readonly label: string;
	readonly icon: typeof ArrowUp;
	readonly onClick: () => void;
	readonly disabled?: boolean;
	readonly destructive?: boolean;
	readonly pressed?: boolean;
	readonly title?: string;
}

export function RowButtons({ buttons }: { buttons: RowButton[] }) {
	return (
		<div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-monti-2 rounded-monti-md bg-monti-page opacity-0 focus-within:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
			{buttons.map((button) => (
				<IconButton
					key={button.label}
					label={button.label}
					tone={button.destructive ? "danger" : undefined}
					pressed={button.pressed}
					disabled={button.disabled}
					title={button.title}
					onClick={button.onClick}
				>
					<button.icon aria-hidden />
				</IconButton>
			))}
		</div>
	);
}

/** Where a row can go, as a list to pick from. */
export function MoveDialog({
	title,
	destinations,
	onClose,
}: {
	title: string;
	destinations: Destination[];
	onClose: () => void;
}) {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent scroll data-testid="move-dialog">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<Stack as="ul" gap={4}>
					{destinations.map((destination) => (
						<li key={destination.label}>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								width="full"
								disabled={destination.disabled}
								onClick={() => {
									destination.run();
									onClose();
								}}
							>
								{destination.label}
							</Button>
						</li>
					))}
				</Stack>
			</DialogContent>
		</Dialog>
	);
}

/** What a top-level row does besides what a field in a conditional branch does: it moves through the tree of tabs and groups. */
export interface TopRow {
	readonly locked: Locked | null;
	/** The row is in a group: a rule along its left edge shows it, there is no indent. */
	readonly member: boolean;
	/** Places the row can be moved to without dragging. */
	readonly destinations: Destination[];
}

export function Row({
	ctx,
	place,
	name,
	field,
	depth,
	count,
	top,
}: {
	ctx: TreeContext;
	place: FieldPlace;
	name: string;
	field: Obj;
	/** How far the row is in: 0 on the list, 1 in a group, 2 in the branch of a conditional field. */
	depth: 0 | 1 | 2;
	count: number;
	top?: TopRow;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const ts = useTranslator(schemaMessages);
	const tp = useTranslator(schemaProblemMessages);
	const tc = useTranslator(schemaChangesMessages);
	const { disabled, file, saved, problems } = useSchemaEdit();
	const { editing } = ctx;
	// The field as saved, when it is saved under this name: a field that differs from it can be put back.
	const savedCollection = collectionsOf(saved)[editing.collectionName];
	const savedField = savedCollection ? fieldAt(savedCollection, place, name) : undefined;
	const changed = savedField !== undefined && !sameJson(savedField, field);
	const mark = place.branch ? undefined : ctx.marks[name];
	const summary = summarizeField(t, name, field, editing.collection, file, !place.branch);
	const path = place.branch
		? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
		: `collections.${editing.collectionName}.fields.${name}`;
	const issues = useIssuesUnder(path);
	// What stops the draft from being saved at this field: its name turns red and the row says what is missing.
	const problem = problems.find((item) => item.path === path);
	const blocked = removeBlock(editing.collection, place, name);
	const locked = top?.locked ?? null;
	// A field in a conditional branch only reorders within its branch, so a branch with one field has nothing to drag.
	const noDrag = disabled || locked !== null || (place.branch !== undefined && count < 2);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: name,
		disabled: noDrag,
	});
	const [moving, setMoving] = useState(false);
	const buttons: RowButton[] = [
		...(changed && savedField
			? [
					{
						label: t("field.revert", { name }),
						icon: Undo,
						disabled,
						onClick: () => editing.update((collection) => setField(collection, place, name, () => savedField)),
					},
				]
			: []),
		...(top && !locked
			? [{ label: t("layout.move", { name }), icon: ArrowRight, disabled, onClick: () => setMoving(true) }]
			: []),
		{
			label: ts("row.remove", { name }),
			icon: TrashCan,
			destructive: true,
			disabled: disabled || blocked !== null,
			onClick: () => editing.update((collection) => removeField(collection, place, name)),
		},
	];
	const tone = problem
		? "danger"
		: mark?.kind === "added"
			? "success"
			: mark?.kind === "renamed"
				? "warning"
				: "default";
	const note = problem
		? tp(`mark.${problem.code}` as "mark.options")
		: mark?.kind === "added"
			? tc("tag.added")
			: mark?.kind === "renamed"
				? `\u2190 ${mark.from}`
				: locked?.kind === "panel"
					? t("layout.notInPanel")
					: undefined;
	const options = field.kind === "conditional" ? Object.keys(optionsOf(field)) : [];
	return (
		<>
			<FieldRow
				ref={setNodeRef}
				data-testid={`field-${name}`}
				motion={{ transform: CSS.Translate.toString(transform) ?? undefined, transition }}
				dragging={isDragging}
				depth={depth}
				name={summary.required ? `${name} !` : name}
				label={typeof field.label === "string" ? field.label : undefined}
				description={typeof field.description === "string" ? field.description : undefined}
				note={note}
				tone={tone}
				kind={summary.token}
				locked={locked?.kind === "plugin" ? t("layout.pluginPlaced") : undefined}
				grip={!noDrag}
				gripProps={{
					ref: setActivatorNodeRef,
					...attributes,
					...listeners,
					"aria-label": t("fields.drag", { name }),
				}}
				changed={changed || mark?.kind === "edited"}
				changedLabel={ts("changed")}
				onOpen={() => ctx.onOpen(place, name)}
				openLabel={t("field.toggle", { name })}
			>
				{issues.length > 0 && (
					<span
						role="img"
						aria-label={t("field.problems", { count: issues.length })}
						className="absolute top-1/2 right-1 size-1.5 -translate-y-1/2 rounded-monti-full bg-monti-danger-emphasis"
					/>
				)}
				<RowButtons buttons={buttons} />
				{moving && top && (
					<MoveDialog
						title={t("layout.moveTitle", { name })}
						destinations={top.destinations}
						onClose={() => setMoving(false)}
					/>
				)}
			</FieldRow>
			{options.map((option) => {
				const children = branchFields(field, option);
				const inner = Math.min(2, depth + 1) as 0 | 1 | 2;
				return (
					<BranchRows
						key={option}
						ctx={ctx}
						holder={name}
						option={option}
						fields={children}
						depth={inner}
						empty={t("fields.noExtra")}
					/>
				);
			})}
		</>
	);
}

/** One choice of a conditional field: its line (`= "note"`) and the fields that show for it, which can be dragged within the choice. */
function BranchRows({
	ctx,
	holder,
	option,
	fields,
	depth,
	empty,
}: {
	ctx: TreeContext;
	holder: string;
	option: string;
	fields: Record<string, Obj>;
	depth: 0 | 1 | 2;
	empty: string;
}) {
	const place: FieldPlace = { branch: { field: holder, option } };
	const names = Object.keys(fields);
	const onReorder = (from: string, to: string) =>
		ctx.editing.update((collection) => reorderField(collection, place, from, to));
	const deeper = Math.min(2, depth + 1) as 0 | 1 | 2;
	return (
		<>
			<FieldRow name={`= "${option}"`} grip={false} depth={depth} note={names.length === 0 ? empty : undefined} />
			<SortableList items={names} onDragEnd={onReorder}>
				{names.map((name) => (
					<Row
						key={name}
						ctx={ctx}
						place={place}
						name={name}
						field={fields[name] ?? {}}
						depth={deeper}
						count={names.length}
					/>
				))}
			</SortableList>
		</>
	);
}
