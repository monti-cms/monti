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
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { AddFieldDialog } from "./add-field";
import { useIssuesUnder, useSchemaEdit } from "./controls";
import type { CollectionEditing } from "./field-editor";
import { FieldSheet } from "./field-sheet";
import { branchFields, type KindTone, summarizeField } from "./field-summary";
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
const COLUMNS =
	"grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-4 sm:grid-cols-[minmax(0,300px)_8.75rem_minmax(0,1fr)]";

interface TreeContext {
	readonly editing: CollectionEditing;
	readonly onOpen: (place: FieldPlace, name: string) => void;
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
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: name,
		disabled,
	});
	const open = () => ctx.onOpen(place, name);
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.target !== event.currentTarget) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			open();
		}
	};
	const actions: MenuAction[] = [
		{ kind: "item", label: t("fields.edit"), icon: Pencil, onSelect: open },
		{
			kind: "item",
			label: t("row.up", { name }),
			icon: ArrowUp,
			disabled: disabled || index === 0,
			onSelect: () => editing.update((collection) => moveField(collection, place, name, -1)),
		},
		{
			kind: "item",
			label: t("row.down", { name }),
			icon: ArrowDown,
			disabled: disabled || index === count - 1,
			onSelect: () => editing.update((collection) => moveField(collection, place, name, 1)),
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: t("row.remove", { name }),
			icon: Trash2,
			destructive: true,
			disabled: disabled || blocked !== null,
			onSelect: () => editing.update((collection) => removeField(collection, place, name)),
		},
	];
	const options = field.kind === "conditional" ? Object.keys(optionsOf(field)) : [];
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
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
						COLUMNS,
						"min-h-[30px] cursor-pointer px-5 outline-none hover:bg-cms-muted/60 focus-visible:bg-cms-muted/60 focus-visible:ring-2 focus-visible:ring-cms-ring/50 focus-visible:ring-inset",
						nested && "bg-cms-muted/20",
					)}
				>
					<div className="flex min-w-0 items-center">
						<span aria-hidden className="whitespace-pre font-mono text-[13px] text-cms-muted-foreground/40">
							{prefix}
						</span>
						<span className="font-mono text-[13px]">{name}</span>
						{label && <span className="ml-2 truncate text-cms-muted-foreground text-xs">{label}</span>}
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
					<div className="hidden min-w-0 truncate pr-8 font-mono text-cms-muted-foreground text-xs sm:block">
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
					disabled={disabled}
					className="absolute top-1/2 left-0.5 flex size-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-cms-muted-foreground opacity-0 outline-none hover:text-cms-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cms-ring/50 disabled:hidden group-hover/row:opacity-100"
				>
					<GripVertical aria-hidden className="size-4" />
				</button>
				<MoreActionsButton
					actions={actions}
					label={t("fields.menu", { name })}
					className="absolute top-1/2 right-2 size-6 -translate-y-1/2 text-cms-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 data-popup-open:opacity-100"
				/>
			</div>
			{options.map((option, at) => {
				const last = at === options.length - 1;
				const children = branchFields(field, option);
				return (
					<div key={option}>
						<div className={cn(COLUMNS, "min-h-[30px] px-5")}>
							<div className="flex min-w-0 items-center">
								<span aria-hidden className="whitespace-pre font-mono text-[13px] text-cms-muted-foreground/40">
									{childLead}
									{last ? "└ " : "├ "}
								</span>
								<span className={cn("font-mono text-[13px]", OPTION)}>= "{option}"</span>
							</div>
							<div />
							<div className="hidden truncate font-mono text-cms-muted-foreground text-xs sm:block">
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

/**
 * The fields of a collection as one aligned tree in a single card: name and label, kind, and the settings in a few words, one line per field. A
 * conditional field lists its choices as branches with their own fields under them. A row opens the field in a sheet on the right.
 */
export function FieldsCard({ editing }: { editing: CollectionEditing }) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const fields = fieldsOf(editing.collection);
	const names = Object.keys(fields);
	const [sheet, setSheet] = useState<{ place: FieldPlace; name: string } | null>(null);
	const [adding, setAdding] = useState(false);
	const ctx: TreeContext = { editing, onOpen: (place, name) => setSheet({ place, name }) };
	return (
		<section className="overflow-hidden rounded-lg border bg-cms-card" data-testid="fields-card">
			<div className="flex items-center justify-between gap-4 border-b px-4 py-3.5">
				<div className="min-w-0">
					<h4 className="font-semibold text-sm">
						{t("field.title")} <span className="font-medium text-cms-muted-foreground">{names.length}</span>
					</h4>
					<p className="mt-0.5 text-cms-muted-foreground text-xs">{t("fields.hint")}</p>
				</div>
				<Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAdding(true)}>
					<Plus aria-hidden />
					{t("field.add")}
				</Button>
			</div>
			<div className={cn(COLUMNS, "border-b px-5 py-2 text-cms-muted-foreground text-xs")} aria-hidden>
				<span>{t("fields.colField")}</span>
				<span>{t("fields.colKind")}</span>
				<span className="hidden sm:block">{t("fields.colSettings")}</span>
			</div>
			<div className="py-1.5 pb-2.5">
				{names.length === 0 ? (
					<p className="px-5 py-3 text-cms-muted-foreground text-xs">{t("field.none")}</p>
				) : (
					<FieldGroup ctx={ctx} place={{}} fields={fields} lead={null} nested={false} />
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
}
