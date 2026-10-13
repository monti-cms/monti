"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, ChevronsDownUp, Eye, GripVertical, MoveRight, Plus, Trash2, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { readPreference, writePreference } from "../../lib/utils/site-storage";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { PanelResizeHandle, usePanelResize } from "../../ui/panel-resize";
import { defaultTab } from "../entries/layout-groups";
import { INSPECTOR_PANEL_RESIZE } from "../shared/side-panel";
import { AddFieldDialog } from "./add-field";
import { useIssuesUnder, useSchemaEdit } from "./controls";
import type { CollectionEditing } from "./field-editor";
import { FieldSheet } from "./field-sheet";
import { branchFields, type KindTone, summarizeField } from "./field-summary";
import {
	addGroup,
	addTab,
	dropFieldOnField,
	editGroup,
	hasTabLevel,
	moveFieldBy,
	moveFieldToTab,
	moveGroup,
	moveGroupBy,
	moveGroupToTab,
	moveOutOfGroup,
	moveTab,
	type NoPanelReason,
	noPanelReason,
	ownTabOf,
	placeField,
	placeOf,
	placeUngrouped,
	removeGroup,
	removeTab,
	renameTab,
	type Tree,
	tabIsEditable,
	tabProblem,
	treeOf,
	withTree,
} from "./layout-model";
import { LayoutPreview } from "./layout-preview";
import { schemaMessages } from "./messages";
import {
	type FieldPlace,
	fieldsOf,
	moveField,
	type Obj,
	optionsOf,
	removeBlock,
	removeField,
	reorderField,
} from "./schema-model";

/** The colour of a kind token in the tree: one family per meaning, light and dark. */
const TONE: Record<KindTone, string> = {
	text: "text-cms-muted-foreground",
	slug: "text-[#0F766E] cms-dark:text-[#5EEAD4]",
	relation: "text-[#2563EB] cms-dark:text-[#93C5FD]",
	backlink: "text-[#0F766E] cms-dark:text-[#5EEAD4]",
	select: "text-[#7C3AED] cms-dark:text-[#C4B5FD]",
	conditional: "text-[#9A3412] cms-dark:text-[#FDBA74]",
	media: "text-[#15803D] cms-dark:text-[#86EFAC]",
	view: "text-cms-muted-foreground/70",
};
const REQUIRED = "text-[#B45309] cms-dark:text-[#FCD34D]";
const OPTION = "text-[#9A3412] cms-dark:text-[#FDBA74]";
const COLUMNS = "grid grid-cols-[minmax(0,300px)_8.75rem_minmax(0,1fr)] items-center gap-x-4";
/** Two columns only, for when the preview takes the room beside the tree. */
const COLUMNS_COMPACT = "grid grid-cols-[minmax(0,360px)_8.75rem] items-center gap-x-4";
const columnsOf = (compact: boolean) => (compact ? COLUMNS_COMPACT : COLUMNS);

interface TreeContext {
	readonly editing: CollectionEditing;
	readonly onOpen: (place: FieldPlace, name: string) => void;
	/** The settings column is left out (the preview is beside the tree). */
	readonly compact: boolean;
}

/** Why a top-level row cannot be moved or grouped. */
type Locked =
	| { readonly kind: "plugin"; readonly tab: string }
	| { readonly kind: "panel"; readonly reason: NoPanelReason };

/** A place a row can be moved to from the move dialog (the keyboard and touch alternative to dragging). */
interface Destination {
	readonly label: string;
	readonly disabled?: boolean;
	readonly run: () => void;
}

/** One icon button of a row: shown on hover and while focus is inside the row, without moving anything. */
interface RowButton {
	readonly label: string;
	readonly icon: typeof ArrowUp;
	readonly onClick: () => void;
	readonly disabled?: boolean;
	readonly destructive?: boolean;
	readonly pressed?: boolean;
}

function RowButtons({ buttons }: { buttons: RowButton[] }) {
	return (
		<div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-cms-card/95 opacity-0 focus-within:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
			{buttons.map((button) => (
				<IconButton
					key={button.label}
					label={button.label}
					size="icon-xs"
					destructive={button.destructive}
					pressed={button.pressed}
					disabled={button.disabled}
					onClick={button.onClick}
				>
					<button.icon aria-hidden />
				</IconButton>
			))}
		</div>
	);
}

/** Where a row can go, as a list to pick from. */
function MoveDialog({
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
interface TopRow {
	readonly locked: Locked | null;
	/** The row is in a group: a rule along its left edge shows it, there is no indent. */
	readonly member: boolean;
	/** Places the row can be moved to without dragging. */
	readonly destinations: Destination[];
	readonly up: () => void;
	readonly down: () => void;
	readonly canUp: boolean;
	readonly canDown: boolean;
}

function Row({
	ctx,
	place,
	name,
	field,
	prefix,
	childLead,
	nested,
	index,
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
	index: number;
	count: number;
	top?: TopRow;
}) {
	const t = useTranslator(schemaMessages);
	const { disabled, file } = useSchemaEdit();
	const { editing } = ctx;
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
		{
			label: t("row.up", { name }),
			icon: ArrowUp,
			disabled: disabled || (top ? !top.canUp || locked !== null : index === 0),
			onClick: () => (top ? top.up() : editing.update((collection) => moveField(collection, place, name, -1))),
		},
		{
			label: t("row.down", { name }),
			icon: ArrowDown,
			disabled: disabled || (top ? !top.canDown || locked !== null : index === count - 1),
			onClick: () => (top ? top.down() : editing.update((collection) => moveField(collection, place, name, 1))),
		},
		...(top && !locked
			? [{ label: t("layout.move", { name }), icon: MoveRight, disabled, onClick: () => setMoving(true) }]
			: []),
		{
			label: t("row.remove", { name }),
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
			className={cn("relative", isDragging && "z-10 bg-cms-card opacity-80")}
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
						"min-h-[30px] cursor-pointer pr-5 pl-9 outline-none hover:bg-cms-muted/60 focus-visible:bg-cms-muted/60 focus-visible:ring-2 focus-visible:ring-cms-ring/50 focus-visible:ring-inset",
						nested && "bg-cms-muted/20",
					)}
				>
					<div className="flex min-w-0 items-center">
						<span aria-hidden className="whitespace-pre font-mono text-[13px] text-cms-muted-foreground/40">
							{prefix}
						</span>
						<span className="max-w-[70%] shrink-0 truncate font-mono text-[13px]" title={name}>
							{name}
						</span>
						{label && (
							<span className="ml-2 min-w-0 truncate text-cms-muted-foreground text-xs" title={label}>
								{label}
							</span>
						)}
						{locked?.kind === "panel" && (
							<span
								className="ml-2 shrink-0 text-cms-muted-foreground/80 text-xs"
								title={t(locked.reason === "title" ? "layout.notInPanel.title" : "layout.notInPanel.hidden")}
							>
								{t("layout.notInPanel")}
							</span>
						)}
						{locked?.kind === "plugin" && (
							<span
								className="ml-2 shrink-0 text-cms-muted-foreground/80 text-xs"
								title={t("layout.pluginPlaced.title", { tab: locked.tab })}
							>
								{t("layout.pluginPlaced")}
							</span>
						)}
						{issues.length > 0 && (
							<span
								role="img"
								aria-label={t("field.problems", { count: issues.length })}
								className="ml-2 size-1.5 shrink-0 rounded-full bg-cms-destructive"
							/>
						)}
					</div>
					<div className="whitespace-nowrap font-mono text-xs">
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
							"hidden min-w-0 truncate pr-8 font-mono text-cms-muted-foreground text-xs",
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
					className="absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-cms-muted-foreground opacity-0 outline-none hover:text-cms-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cms-ring/50 disabled:hidden group-hover/row:opacity-100"
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
						<div className={cn(columnsOf(ctx.compact), "min-h-[30px] pr-5 pl-9")}>
							<div className="flex min-w-0 items-center">
								<span aria-hidden className="whitespace-pre font-mono text-[13px] text-cms-muted-foreground/40">
									{childLead}
									{last ? "└ " : "├ "}
								</span>
								<span className={cn("font-mono text-[13px]", OPTION)}>= "{option}"</span>
							</div>
							<div />
							<div
								className={cn("hidden truncate font-mono text-cms-muted-foreground text-xs", !ctx.compact && "block")}
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
function FieldGroup({
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
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor),
	);
	const names = Object.keys(fields);
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		ctx.editing.update((collection) => reorderField(collection, place, String(active.id), String(over.id)));
	};
	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={names} strategy={verticalListSortingStrategy}>
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
							index={index}
							count={names.length}
						/>
					);
				})}
			</SortableContext>
		</DndContext>
	);
}

/** An input that edits a name in place: it changes the tree on Enter or when it loses focus, and Escape gives the old name back. */
function InlineName({
	value,
	label,
	disabled,
	inputRef,
	onCommit,
	className,
}: {
	value: string;
	label: string;
	disabled: boolean;
	inputRef?: React.RefObject<HTMLInputElement | null>;
	onCommit: (value: string) => void;
	className?: string;
}) {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	const commit = () => {
		if (draft.trim() === "" || draft.trim() === value) setDraft(value);
		else onCommit(draft.trim());
	};
	return (
		<Input
			ref={inputRef}
			value={draft}
			aria-label={label}
			disabled={disabled}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit();
				} else if (event.key === "Escape") {
					setDraft(value);
				}
			}}
			className={cn(
				"h-7 min-w-0 border-transparent bg-transparent px-1.5 font-semibold text-sm shadow-none",
				className,
			)}
		/>
	);
}

const groupId = (tab: number, block: number) => `group:${tab}:${block}`;
const emptyId = (tab: number, block: number) => `empty:${tab}:${block}`;
const tabId = (tab: number) => `tab:${tab}`;
const endId = (tab: number) => `end:${tab}`;
const parseBlockId = (id: string, kind: "group" | "empty"): { tab: number; block: number } | null => {
	const match = new RegExp(`^${kind}:(\\d+):(\\d+)$`).exec(id);
	return match ? { tab: Number(match[1]), block: Number(match[2]) } : null;
};
const parseTabId = (id: string): number | null => {
	const match = /^(?:tab|end):(\d+)$/.exec(id);
	return match ? Number(match[1]) : null;
};

interface LayoutOps {
	/** Applies a change to the tree of the collection as it is when the change runs. */
	readonly change: (next: (tree: Tree) => Tree) => void;
	readonly tree: Tree;
	readonly showTabs: boolean;
	readonly disabled: boolean;
}

/** A tab of the panel as a row of the tree: only drawn once the collection has more than the default tab. */
function TabRow({ ops, index }: { ops: LayoutOps; index: number }) {
	const t = useTranslator(schemaMessages);
	const tab = ops.tree.tabs[index];
	const { setNodeRef, transform, transition } = useSortable({ id: tabId(index), disabled: { draggable: true } });
	const inputRef = useRef<HTMLInputElement | null>(null);
	if (!tab) return null;
	const editable = tabIsEditable(ops.tree, index);
	const count = ops.tree.tabs.length;
	const buttons: RowButton[] = [
		{
			label: t("layout.upTab", { name: tab.name }),
			icon: ArrowUp,
			disabled: ops.disabled || index < 2,
			onClick: () => ops.change((tree) => moveTab(tree, index, -1)),
		},
		{
			label: t("layout.downTab", { name: tab.name }),
			icon: ArrowDown,
			disabled: ops.disabled || index === 0 || index === count - 1,
			onClick: () => ops.change((tree) => moveTab(tree, index, 1)),
		},
		{
			label: t("layout.removeTab", { name: tab.name }),
			icon: Trash2,
			destructive: true,
			disabled: ops.disabled || !editable,
			onClick: () => ops.change((tree) => removeTab(tree, index)),
		},
	];
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			data-testid={`tab-${index}`}
			className="group/row relative mt-3 flex items-center gap-1 border-y bg-cms-muted py-1.5 pr-5 pl-9 first:mt-0"
		>
			<InlineName
				value={tab.name}
				label={t("layout.tabName")}
				disabled={ops.disabled || !editable}
				inputRef={inputRef}
				onCommit={(name) => ops.change((tree) => renameTab(tree, index, name))}
				className="-ml-1.5 font-semibold"
			/>
			<span className="flex-1" />
			{!editable && index > 0 && (
				<span className="shrink-0 pr-1 text-cms-muted-foreground text-xs" title={t("layout.tabLocked")}>
					{t("layout.pluginPlaced")}
				</span>
			)}
			<RowButtons buttons={buttons} />
		</div>
	);
}

/** A group of the panel as a row of the tree: its title is edited in place, its fields sit under it. */
function GroupRow({ ops, tab, block }: { ops: LayoutOps; tab: number; block: number }) {
	const t = useTranslator(schemaMessages);
	const group = ops.tree.tabs[tab]?.blocks[block];
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: groupId(tab, block),
		disabled: ops.disabled,
	});
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [moving, setMoving] = useState(false);
	if (!group || group.title === null) return null;
	const ref = { tab, block };
	const count = ops.tree.tabs[tab]?.blocks.length ?? 0;
	const buttons: RowButton[] = [
		{
			label: t("layout.collapseToggle", { name: group.title }),
			icon: ChevronsDownUp,
			pressed: group.collapsed === true,
			disabled: ops.disabled,
			onClick: () => ops.change((tree) => editGroup(tree, ref, { collapsed: !group.collapsed })),
		},
		{
			label: t("layout.upGroup", { name: group.title }),
			icon: ArrowUp,
			disabled: ops.disabled || block === 0,
			onClick: () => ops.change((tree) => moveGroupBy(tree, ref, -1)),
		},
		{
			label: t("layout.downGroup", { name: group.title }),
			icon: ArrowDown,
			disabled: ops.disabled || block === count - 1,
			onClick: () => ops.change((tree) => moveGroupBy(tree, ref, 1)),
		},
		...(ops.showTabs
			? [
					{
						label: t("layout.moveGroup", { name: group.title }),
						icon: MoveRight,
						disabled: ops.disabled,
						onClick: () => setMoving(true),
					},
				]
			: []),
		{
			label: t("layout.removeGroup", { name: group.title }),
			icon: Trash2,
			destructive: true,
			disabled: ops.disabled,
			onClick: () => ops.change((tree) => removeGroup(tree, ref)),
		},
	];
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn("group/row relative mt-1 border-y bg-cms-muted/30", isDragging && "z-10 bg-cms-card opacity-80")}
			data-testid={`group-${tab}-${block}`}
		>
			<div className="flex items-center gap-1 py-0.5 pr-5 pl-9">
				<InlineName
					className="-ml-1.5"
					value={group.title}
					label={t("layout.groupTitle")}
					disabled={ops.disabled}
					inputRef={inputRef}
					onCommit={(title) => ops.change((tree) => editGroup(tree, ref, { title }))}
				/>
				{group.collapsed && (
					<span className="shrink-0 text-cms-muted-foreground text-xs">{t("layout.collapsedMark")}</span>
				)}
				<span className="flex-1" />
				<RowButtons buttons={buttons} />
				{moving && (
					<MoveDialog
						title={t("layout.moveGroupTitle", { name: group.title })}
						destinations={ops.tree.tabs.flatMap((item, at): Destination[] =>
							at === tab ? [] : [{ label: item.name, run: () => ops.change((tree) => moveGroupToTab(tree, ref, at)) }],
						)}
						onClose={() => setMoving(false)}
					/>
				)}
			</div>
			<button
				type="button"
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				aria-label={t("layout.dragGroup", { name: group.title })}
				disabled={ops.disabled}
				className="absolute top-1/2 left-2.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-cms-muted-foreground opacity-0 outline-none hover:text-cms-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cms-ring/50 disabled:hidden group-hover/row:opacity-100"
			>
				<GripVertical aria-hidden className="size-4" />
			</button>
		</div>
	);
}

/** The place to drop a field into a group that has none, or after the last block of a tab. */
function DropRow({ id, label, testId }: { id: string; label?: string; testId: string }) {
	const { setNodeRef, transform, transition } = useSortable({ id, disabled: { draggable: true } });
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn("pr-5 pl-9 text-cms-muted-foreground text-xs", label ? "py-1" : "h-2")}
			data-testid={testId}
		>
			{label}
		</div>
	);
}

/**
 * The top-level fields as the properties panel lays them out: tab, then group, then field. Fields are dragged into and out of groups and tabs (the row menus do the
 * same without dragging). Every change writes the tree back as the order of `fields` and `layout` together.
 */
function LayoutTree({ editing, ctx }: { editing: CollectionEditing; ctx: TreeContext }) {
	const t = useTranslator(schemaMessages);
	const site = useSite();
	const { disabled } = useSchemaEdit();
	const first = defaultTab(site);
	const collection = editing.collection;
	const tree = treeOf(collection, first);
	const showTabs = hasTabLevel(tree);
	const change = (next: (tree: Tree) => Tree) =>
		editing.update((current) => withTree(current, next(treeOf(current, first))));
	const ops: LayoutOps = { change, tree, showTabs, disabled };
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const fields = fieldsOf(collection);

	const rows: { id: string; node: React.ReactNode }[] = [];
	const fieldRow = (name: string, member: boolean, locked: Locked | null) => {
		const here = placeOf(tree, name);
		const inGroup = here !== null && tree.tabs[here.tab]?.blocks[here.block]?.title !== null;
		const moveUp = locked ? tree : moveFieldBy(tree, name, -1);
		const moveDown = locked ? tree : moveFieldBy(tree, name, 1);
		const same = (other: Tree) => JSON.stringify(other) === JSON.stringify(tree);
		const destinations: Destination[] = locked
			? []
			: [
					...tree.tabs.flatMap((tab, at): Destination[] => [
						...tab.blocks.flatMap((block, g): Destination[] =>
							block.title === null
								? []
								: [
										{
											label: showTabs ? `${tab.name} / ${block.title}` : block.title,
											disabled: here?.tab === at && here.block === g,
											run: () => change((current) => placeField(current, name, at, g)),
										},
									],
						),
						{
							label: showTabs ? `${tab.name} / ${t("layout.noGroup")}` : t("layout.noGroup"),
							run: () => change((current) => placeUngrouped(current, name, at)),
						},
					]),
					...(inGroup
						? [{ label: t("layout.moveOut"), run: () => change((current) => moveOutOfGroup(current, name)) }]
						: []),
				];
		rows.push({
			id: name,
			node: (
				<Row
					key={name}
					ctx={ctx}
					place={{}}
					name={name}
					field={fields[name] ?? {}}
					prefix=""
					childLead="  "
					nested={false}
					index={0}
					count={1}
					top={{
						member,
						locked,
						destinations,
						up: () => change((current) => moveFieldBy(current, name, -1)),
						down: () => change((current) => moveFieldBy(current, name, 1)),
						canUp: !same(moveUp),
						canDown: !same(moveDown),
					}}
				/>
			),
		});
	};

	for (const name of tree.pinned) {
		fieldRow(name, false, { kind: "panel", reason: noPanelReason(collection, name) ?? "hidden" });
	}
	for (const [at, tab] of tree.tabs.entries()) {
		if (showTabs) rows.push({ id: tabId(at), node: <TabRow key={tabId(at)} ops={ops} index={at} /> });
		for (const [b, block] of tab.blocks.entries()) {
			if (block.title === null) {
				for (const name of block.fields) fieldRow(name, false, null);
				continue;
			}
			rows.push({
				id: groupId(at, b),
				node: <GroupRow key={groupId(at, b)} ops={ops} tab={at} block={b} />,
			});
			if (block.fields.length === 0) {
				rows.push({
					id: emptyId(at, b),
					node: (
						<DropRow
							key={emptyId(at, b)}
							id={emptyId(at, b)}
							label={t("layout.emptyGroup")}
							testId={`empty-${at}-${b}`}
						/>
					),
				});
			}
			for (const name of block.fields) fieldRow(name, true, null);
		}
		rows.push({
			id: endId(at),
			node: <DropRow key={endId(at)} id={endId(at)} testId={`end-${at}`} />,
		});
		for (const name of tab.locked)
			fieldRow(name, false, { kind: "plugin", tab: ownTabOf(collection, name) ?? tab.name });
	}

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = String(active.id);
		const to = String(over.id);
		change((current) => {
			const group = parseBlockId(from, "group");
			const toGroup = parseBlockId(to, "group");
			const toEmpty = parseBlockId(to, "empty");
			const toTab = parseTabId(to);
			if (group) {
				if (toGroup) return moveGroup(current, group, toGroup);
				if (toEmpty) return moveGroup(current, group, toEmpty);
				if (toTab !== null) return moveGroup(current, group, { tab: toTab, block: Number.MAX_SAFE_INTEGER });
				const place = placeOf(current, to);
				return place ? moveGroup(current, group, { tab: place.tab, block: place.block }) : current;
			}
			// A field dropped on a group's title leaves its group for the place just before that group.
			if (toGroup) return placeUngrouped(current, from, toGroup.tab, toGroup.block);
			if (toEmpty) return placeField(current, from, toEmpty.tab, toEmpty.block);
			if (toTab !== null) return placeUngrouped(current, from, toTab, to.startsWith("end:") ? undefined : 0);
			return dropFieldOnField(current, from, to);
		});
	};

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
			<SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
				{rows.map((row) => row.node)}
			</SortableContext>
		</DndContext>
	);
}

const WIDE_QUERY = "(min-width: 1280px)";

/** The width of an element, followed as it changes; `null` until it is measured. Give the element the returned ref callback: it follows the element if React replaces it. */
function useElementWidth<T extends HTMLElement>(): [(element: T | null) => void, number | null] {
	const [element, setElement] = useState<T | null>(null);
	const [width, setWidth] = useState<number | null>(null);
	useEffect(() => {
		if (!element || typeof ResizeObserver === "undefined") return;
		setWidth(element.getBoundingClientRect().width);
		const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, [element]);
	return [setElement, width];
}

/** The tree shows its settings column from this card width on; narrower, it keeps the name and kind readable. */
const SETTINGS_MIN_WIDTH = 760;

/** Whether the window is wide enough for the preview to sit beside the tree. */
function useWide(): boolean {
	const [wide, setWide] = useState(false);
	useEffect(() => {
		const media = window.matchMedia?.(WIDE_QUERY);
		if (!media) return;
		const update = () => setWide(media.matches);
		update();
		media.addEventListener?.("change", update);
		return () => media.removeEventListener?.("change", update);
	}, []);
	return wide;
}

/** The preview on a narrower window: a panel on the right that the writer can widen, with the tree still reachable beside it. */
function PreviewDrawer({ preview, onClose }: { preview: ReactNode; onClose: () => void }) {
	const t = useTranslator(schemaMessages);
	const resize = usePanelResize({ ...INSPECTOR_PANEL_RESIZE, name: "layout-preview", minWidth: 320 });
	return (
		<aside
			aria-label={t("layout.previewTitle")}
			style={resize.style}
			className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-cms-popover sm:w-[var(--panel-width)]"
			data-testid="layout-preview-drawer"
		>
			<PanelResizeHandle resize={resize} />
			<div className="flex h-11 shrink-0 items-center justify-between border-b pr-2 pl-4">
				<h2 className="font-medium text-sm">{t("layout.preview")}</h2>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={t("layout.previewClose")} onClick={onClose}>
					<X aria-hidden />
				</Button>
			</div>
			<div className="flex min-h-0 flex-1 flex-col p-3">{preview}</div>
		</aside>
	);
}

/** Whether the preview is open: remembered in this browser; open on a wide window until the writer closes it. */
function usePreviewOpen(wide: boolean): [boolean, (open: boolean) => void] {
	const site = useSite();
	const [chosen, setChosen] = useState<boolean | null>(null);
	useEffect(() => {
		const saved = readPreference(site, "layout-preview-open");
		setChosen(saved === "1" ? true : saved === "0" ? false : null);
	}, [site]);
	return [
		chosen ?? wide,
		(open) => {
			setChosen(open);
			writePreference(site, "layout-preview-open", open ? "1" : "0");
		},
	];
}

/**
 * The fields of a collection as one aligned tree in a single card: name and label, kind, and the settings in a few words, one line per field. The top-level
 * fields sit in the tabs and groups of the properties panel, with a preview of that panel beside the tree (or in a side panel on a narrower window). A
 * conditional field lists its choices as branches with their own fields under them. A row opens the field in a sheet on the right.
 */
export function FieldsCard({ editing }: { editing: CollectionEditing }) {
	const t = useTranslator(schemaMessages);
	const site = useSite();
	const { disabled } = useSchemaEdit();
	const fields = fieldsOf(editing.collection);
	const names = Object.keys(fields);
	const [sheet, setSheet] = useState<{ place: FieldPlace; name: string } | null>(null);
	const [adding, setAdding] = useState(false);
	const wide = useWide();
	const [cardRef, cardWidth] = useElementWidth<HTMLElement>();
	const showSettings = cardWidth === null || cardWidth >= SETTINGS_MIN_WIDTH;
	const [previewOpen, setPreviewOpen] = usePreviewOpen(wide);
	const sideResize = usePanelResize({ ...INSPECTOR_PANEL_RESIZE, name: "layout-preview-side", minWidth: 320 });
	const { file, codeCollections } = useSchemaEdit();
	const first = defaultTab(site);
	const ctx: TreeContext = {
		editing,
		onOpen: (place, name) => setSheet({ place, name }),
		compact: !showSettings,
	};
	const addTo = (make: (tree: Tree) => Tree) =>
		editing.update((current) => withTree(current, make(treeOf(current, first))));
	const unique = (base: string, taken: string[]) => {
		let name = base;
		for (let n = 2; taken.includes(name); n += 1) name = `${base} ${n}`;
		return name;
	};
	const addGroupRow = () =>
		addTo((tree) =>
			addGroup(
				tree,
				0,
				unique(
					t("layout.newGroup"),
					tree.tabs.flatMap((tab) => tab.blocks.flatMap((block) => (block.title === null ? [] : [block.title]))),
				),
			),
		);
	const addTabRow = () =>
		addTo((tree) => {
			const name = unique(
				t("layout.newTab"),
				tree.tabs.map((tab) => tab.name),
			);
			return tabProblem(tree, name) === null ? addTab(tree, name) : tree;
		});
	const card = (
		<section
			ref={cardRef}
			className="min-w-0 max-w-[1000px] overflow-hidden rounded-lg border bg-cms-card"
			data-testid="fields-card"
		>
			<div className="flex items-center justify-between gap-4 border-b px-4 py-3.5">
				<div className="min-w-0">
					<h4 className="font-semibold text-sm">
						{t("field.title")} <span className="font-medium text-cms-muted-foreground">{names.length}</span>
					</h4>
					<p className="mt-0.5 truncate text-cms-muted-foreground text-xs" title={t("fields.hint")}>
						{t("fields.hint")}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
					<IconButton
						label={t("layout.preview")}
						size="icon-sm"
						pressed={previewOpen}
						onClick={() => setPreviewOpen(!previewOpen)}
					>
						<Eye aria-hidden />
					</IconButton>
					<Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addTabRow}>
						<Plus aria-hidden />
						{t("layout.addTab")}
					</Button>
					<Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addGroupRow}>
						<Plus aria-hidden />
						{t("layout.addGroup")}
					</Button>
					<Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAdding(true)}>
						<Plus aria-hidden />
						{t("field.add")}
					</Button>
				</div>
			</div>
			<div
				className={cn(columnsOf(ctx.compact), "border-b py-2 pr-5 pl-9 text-cms-muted-foreground text-xs")}
				aria-hidden
			>
				<span>{t("fields.colField")}</span>
				<span>{t("fields.colKind")}</span>
				<span className={cn("hidden", !ctx.compact && "block")}>{t("fields.colSettings")}</span>
			</div>
			<div className="py-1.5 pb-2.5">
				{names.length === 0 ? (
					<p className="px-5 py-3 text-cms-muted-foreground text-xs">{t("field.none")}</p>
				) : (
					<LayoutTree editing={editing} ctx={ctx} />
				)}
			</div>
			<div className="flex flex-wrap gap-x-5 gap-y-1 border-t px-5 py-2.5 text-cms-muted-foreground text-xs">
				<span>
					<span className={cn("font-mono", REQUIRED)}>!</span> {t("fields.legendRequired")}
				</span>
				<span>
					<span className={cn("font-mono", TONE.relation)}>→</span> {t("fields.legendRelation")}
				</span>
				<span>
					<span className={cn("font-mono", TONE.backlink)}>←</span> {t("fields.legendBacklink")}
				</span>
				<span>
					<span className={cn("font-mono", OPTION)}>= "…"</span> {t("fields.legendOption")}
				</span>
				<span className="flex-1" />
				<span>{t("fields.legendOpen")}</span>
			</div>
			{adding && (
				<AddFieldDialog
					editing={editing}
					place={{}}
					onClose={() => setAdding(false)}
					onAdded={(name) => {
						setAdding(false);
						setSheet({ place: {}, name });
					}}
				/>
			)}
			{sheet && (
				<FieldSheet
					key={`${sheet.name}`}
					editing={editing}
					place={sheet.place}
					name={sheet.name}
					onClose={() => setSheet(null)}
				/>
			)}
		</section>
	);
	const preview = (
		<LayoutPreview
			file={file}
			collection={editing.collectionName}
			codeCollections={codeCollections}
			onClose={() => setPreviewOpen(false)}
		/>
	);
	return (
		<>
			{wide && previewOpen ? (
				<div
					className="grid grid-cols-[minmax(0,1000px)_var(--panel-width)] items-start gap-6"
					style={sideResize.style}
				>
					{card}
					<div className="sticky top-4 flex h-[min(48rem,calc(100vh-6rem))] flex-col" data-testid="layout-preview-side">
						<PanelResizeHandle resize={sideResize} className="-left-3.5" />
						{preview}
					</div>
				</div>
			) : (
				card
			)}
			{!wide && previewOpen && <PreviewDrawer preview={preview} onClose={() => setPreviewOpen(false)} />}
		</>
	);
}
