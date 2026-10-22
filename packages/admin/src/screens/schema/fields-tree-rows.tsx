"use client";

// The rows of the fields tree: a field row (with the branches of a conditional field), its icon buttons and move dialog.
// Dragging itself lives in fields-tree-dnd.tsx; the tab and group rows of the layout in fields-tree-layout-rows.tsx.

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslator } from "@monti-cms/core/site";
import { Button, cn, Dialog, DialogContent, DialogHeader, DialogTitle, IconButton } from "@monti-cms/ui";
import { type ArrowUp, GripVertical, MoveRight, Trash2, Undo2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { ChangeDot, useIssuesUnder, useSchemaEdit } from "./controls";
import type { CollectionEditing } from "./field-editor";
import { branchFields, type KindTone, summarizeField } from "./field-summary";
import { schemaFieldsMessages } from "./fields.messages";
import { SortableList } from "./fields-tree-dnd";
import { schemaMessages } from "./messages";
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

/** The colour of a kind token in the tree: one family per meaning, light and dark. */
export const TONE: Record<KindTone, string> = {
	text: "text-monti-muted",
	slug: "text-monti-kind-teal",
	relation: "text-monti-kind-blue",
	backlink: "text-monti-kind-teal",
	select: "text-monti-kind-violet",
	conditional: "text-monti-kind-orange",
	media: "text-monti-kind-green",
	view: "text-monti-subtle",
};
export const REQUIRED = "text-monti-warning";
export const OPTION = "text-monti-kind-orange";
const COLUMNS = "grid grid-cols-[minmax(0,300px)_8.75rem_minmax(0,1fr)] items-center gap-x-4";
/** Two columns only, for when the preview takes the room beside the tree. */
const COLUMNS_COMPACT = "grid grid-cols-[minmax(0,360px)_8.75rem] items-center gap-x-4";
export const columnsOf = (compact: boolean) => (compact ? COLUMNS_COMPACT : COLUMNS);

export interface TreeContext {
	readonly editing: CollectionEditing;
	readonly onOpen: (place: FieldPlace, name: string) => void;
	/** The settings column is left out (the preview is beside the tree). */
	readonly compact: boolean;
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
		<div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-monti-surface opacity-0 focus-within:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
			{buttons.map((button) => (
				<IconButton
					key={button.label}
					label={button.label}
					size="icon-xs"
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
			<DialogContent className="max-w-sm" data-testid="move-dialog">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
					{destinations.map((destination) => (
						<li key={destination.label}>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="w-full justify-start"
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
				</ul>
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
	prefix,
	childLead,
	nested,
	count,
	top,
}: {
	ctx: TreeContext;
	place: FieldPlace;
	name: string;
	field: Obj;
	prefix: string;
	childLead: string;
	nested: boolean;
	count: number;
	top?: TopRow;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled, file, saved } = useSchemaEdit();
	const { editing } = ctx;
	// The field as saved, when it is saved under this name: a field that differs from it can be put back.
	const savedCollection = collectionsOf(saved)[editing.collectionName];
	const savedField = savedCollection ? fieldAt(savedCollection, place, name) : undefined;
	const changed = savedField !== undefined && !sameJson(savedField, field);
	const summary = summarizeField(t, name, field, editing.collection, file, !place.branch);
	const path = place.branch
		? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
		: `collections.${editing.collectionName}.fields.${name}`;
	const issues = useIssuesUnder(path);
	const label = typeof field.label === "string" ? field.label : "";
	const blocked = removeBlock(editing.collection, place, name);
	const locked = top?.locked ?? null;
	// A field in a conditional branch only reorders within its branch, so a branch with one field has nothing to drag.
	const noDrag = disabled || locked !== null || (place.branch !== undefined && count < 2);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: name,
		disabled: noDrag,
	});
	const open = () => ctx.onOpen(place, name);
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.target !== event.currentTarget) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			open();
		}
	};
	const [moving, setMoving] = useState(false);
	const buttons: RowButton[] = [
		...(changed && savedField
			? [
					{
						label: t("field.revert", { name }),
						icon: Undo2,
						disabled,
						onClick: () => editing.update((collection) => setField(collection, place, name, () => savedField)),
					},
				]
			: []),
		...(top && !locked
			? [{ label: t("layout.move", { name }), icon: MoveRight, disabled, onClick: () => setMoving(true) }]
			: []),
		{
			label: ts("row.remove", { name }),
			icon: Trash2,
			destructive: true,
			disabled: disabled || blocked !== null,
			onClick: () => editing.update((collection) => removeField(collection, place, name)),
		},
	];
	const options = field.kind === "conditional" ? Object.keys(optionsOf(field)) : [];
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn("relative", isDragging && "z-10 bg-monti-surface opacity-80")}
			data-testid={`field-${name}`}
		>
			<div className="group/row relative">
				{/* biome-ignore lint/a11y/useSemanticElements: a row holds a grid of cells and is operated like a button; real buttons (handle, menu) sit beside it */}
				<div
					role="button"
					tabIndex={0}
					aria-label={t("field.toggle", { name })}
					onClick={open}
					onKeyDown={onKeyDown}
					className={cn(
						columnsOf(ctx.compact),
						"min-h-[30px] cursor-pointer py-2 pr-4 pl-8 outline-none hover:bg-monti-hover focus-visible:bg-monti-hover focus-visible:ring-2 focus-visible:ring-monti-focus-soft focus-visible:ring-inset",
						nested && "bg-monti-inset",
					)}
				>
					<div className="flex min-w-0 items-center">
						<span aria-hidden className="whitespace-pre font-mono text-monti-label text-monti-subtle">
							{prefix}
						</span>
						<span className="max-w-[70%] shrink-0 truncate font-mono text-monti-label" title={name}>
							{name}
						</span>
						{label && (
							<span className="ml-2 min-w-0 truncate text-monti-caption text-monti-muted" title={label}>
								{label}
							</span>
						)}
						{changed && <ChangeDot className="ml-2" />}
						{locked?.kind === "panel" && (
							<span className="ml-2 shrink-0 text-monti-caption text-monti-muted" title={t("layout.notInPanel.title")}>
								{t("layout.notInPanel")}
							</span>
						)}
						{locked?.kind === "plugin" && (
							<span
								className="ml-2 shrink-0 text-monti-caption text-monti-muted"
								title={t("layout.pluginPlaced.title", { tab: locked.tab })}
							>
								{t("layout.pluginPlaced")}
							</span>
						)}
						{issues.length > 0 && (
							<span
								role="img"
								aria-label={t("field.problems", { count: issues.length })}
								className="ml-2 size-1.5 shrink-0 rounded-full bg-monti-danger-emphasis"
							/>
						)}
					</div>
					<div className="whitespace-nowrap font-mono text-monti-caption">
						<span className={TONE[summary.tone]}>{summary.token}</span>
						{summary.required && (
							<span className={REQUIRED} title={t("field.requiredBadge")}>
								{" "}
								!
							</span>
						)}
					</div>
					<div
						className={cn(
							"hidden min-w-0 truncate pr-8 font-mono text-monti-caption text-monti-muted",
							!ctx.compact && "block",
						)}
					>
						{summary.isTitle && (
							<span data-testid="title-badge">
								{t("sum.title")}
								{summary.detail ? " · " : ""}
							</span>
						)}
						{summary.detail}
					</div>
				</div>
				<button
					type="button"
					ref={setActivatorNodeRef}
					{...attributes}
					{...listeners}
					aria-label={t("fields.drag", { name })}
					disabled={noDrag}
					className="absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-monti-muted opacity-0 outline-none hover:text-monti-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-monti-focus-soft disabled:hidden group-hover/row:opacity-100"
				>
					<GripVertical aria-hidden className="size-4" />
				</button>
				<RowButtons buttons={buttons} />
				{moving && top && (
					<MoveDialog
						title={t("layout.moveTitle", { name })}
						destinations={top.destinations}
						onClose={() => setMoving(false)}
					/>
				)}
			</div>
			{options.map((option, at) => {
				const last = at === options.length - 1;
				const children = branchFields(field, option);
				return (
					<div key={option}>
						<div className={cn(columnsOf(ctx.compact), "min-h-[30px] py-2 pr-4 pl-8")}>
							<div className="flex min-w-0 items-center">
								<span aria-hidden className="whitespace-pre font-mono text-monti-label text-monti-subtle">
									{childLead}
									{last ? "└ " : "├ "}
								</span>
								<span className={cn("font-mono text-monti-label", OPTION)}>= "{option}"</span>
							</div>
							<div />
							<div
								className={cn("hidden truncate font-mono text-monti-caption text-monti-muted", !ctx.compact && "block")}
							>
								{Object.keys(children).length === 0 ? t("fields.noExtra") : ""}
							</div>
						</div>
						{Object.keys(children).length > 0 && (
							<FieldGroup
								ctx={ctx}
								place={{ branch: { field: name, option } }}
								fields={children}
								lead={childLead + (last ? "   " : "│  ")}
								nested
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

/** One list of fields (the top level, or the fields of one option): rows that can be dragged within the list. */
export function FieldGroup({
	ctx,
	place,
	fields,
	lead,
	nested,
}: {
	ctx: TreeContext;
	place: FieldPlace;
	fields: Record<string, Obj>;
	/** The tree lines in front of the rows (`null` at the top level, where there are none). */
	lead: string | null;
	nested: boolean;
}) {
	const names = Object.keys(fields);
	const onReorder = (from: string, to: string) =>
		ctx.editing.update((collection) => reorderField(collection, place, from, to));
	return (
		<SortableList items={names} onDragEnd={onReorder}>
			{names.map((name, index) => {
				const last = index === names.length - 1;
				const prefix = lead === null ? "" : lead + (last ? "└ " : "├ ");
				const childLead = lead === null ? "  " : lead + (last ? "   " : "│  ");
				return (
					<Row
						key={name}
						ctx={ctx}
						place={place}
						name={name}
						field={fields[name] ?? {}}
						prefix={prefix}
						childLead={childLead}
						nested={nested}
						count={names.length}
					/>
				);
			})}
		</SortableList>
	);
}
