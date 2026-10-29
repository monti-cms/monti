"use client";

import { ArrowLeft, ArrowRight, TrashCan } from "@carbon/icons-react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	DEFAULT_TAB,
	fieldSetsOf,
	hasFieldSet,
	placementsOf,
	type Site,
	useSite,
	useTranslator,
} from "@monti-cms/core/site";
import {
	FieldRow,
	FieldTree,
	FolderTab,
	FolderTabEdit,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	IconButton,
	Inline,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useEffect, useMemo, useState } from "react";
import { booleanCodec, type PreferenceCodec, usePreference } from "../../lib/hooks/use-preference";
import { tabLabel } from "../entries/layout-groups";
import { DockedPanel } from "../shared/side-panel";
import { AddFieldSheet } from "./add-field";
import { schemaChangesMessages } from "./changes.messages";
import { useSchemaEdit } from "./controls";
import type { CollectionEditing } from "./field-editor";
import { fieldMarks } from "./field-marks";
import { FieldSheet } from "./field-sheet";
import { schemaFieldsMessages } from "./fields.messages";
import { emptyId, endId, groupId, LayoutDnd, tabId } from "./fields-tree-dnd";
import { DropRow, GroupRow, InlineName, type LayoutOps } from "./fields-tree-layout-rows";
import { type Destination, type Locked, Row, type TreeContext } from "./fields-tree-rows";
import {
	addGroup,
	addTab,
	hasTabLevel,
	moveOutOfGroup,
	moveTab,
	placeField,
	placeOf,
	placeUngrouped,
	removeTab,
	renameTab,
	type Tree,
	tabCanRemove,
	tabCanRename,
	tabProblem,
	treeOf,
	withTree,
} from "./layout-model";
import { LayoutPreview } from "./layout-preview";
import { addFieldSet, type FieldPlace, fieldsOf } from "./schema-model";

/** The name a tab of the panel goes by: the first is the default tab, which can carry a name of its own. */
const tabNameOf = (site: Site, tree: Tree, at: number): string =>
	at === 0 ? (tree.defaultTab ?? tabLabel(site, tree.tabs[0]?.name ?? DEFAULT_TAB)) : (tree.tabs[at]?.name ?? "");

/** How many fields a tab of the panel holds. */
const fieldsInTab = (tree: Tree, at: number): number =>
	(tree.tabs[at]?.blocks.reduce((sum, block) => sum + block.fields.length, 0) ?? 0) +
	(tree.tabs[at]?.locked.length ?? 0) +
	(at === 0 ? tree.pinned.length : 0);

/** One tab of the folder tabs: it is dragged to a new place (the default tab stays first), and pressing the picked one opens its name for editing. */
function SortableTab({
	ops,
	index,
	name,
	count,
	editable,
	onEdit,
}: {
	ops: LayoutOps;
	index: number;
	name: string;
	count: number;
	editable: boolean;
	onEdit: () => void;
}) {
	const locked = !tabCanRename(ops.tree, index);
	const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: tabId(index),
		disabled: ops.disabled || index === 0,
	});
	return (
		<FolderTab
			ref={setNodeRef}
			value={String(index)}
			count={count}
			locked={locked && index > 0}
			draggable={!ops.disabled && index > 0}
			motion={{ transform: CSS.Translate.toString(transform) ?? undefined, transition }}
			dragging={isDragging}
			data-testid={`tab-${index}`}
			{...listeners}
			onClick={(event) => {
				listeners?.onClick?.(event);
				if (editable) onEdit();
			}}
		>
			{name}
		</FolderTab>
	);
}

/** The tabs of the panel as folder tabs over the fields of the picked one. */
function TabStrip({
	ops,
	site,
	active,
	onActive,
	onAdd,
}: {
	ops: LayoutOps;
	site: Site;
	active: number;
	onActive: (index: number) => void;
	onAdd: () => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const [editing, setEditing] = useState<number | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const defaultName = tabLabel(site, DEFAULT_TAB);
	const { tabs } = ops.tree;
	const move = (index: number, delta: -1 | 1) => {
		ops.change((tree) => moveTab(tree, index, delta));
		onActive(index + delta);
		setEditing(index + delta);
	};
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={({ active: dragged, over }) => {
				const from = Number(String(dragged.id).replace("tab:", ""));
				const to = Number(String(over?.id ?? "").replace("tab:", ""));
				if (!over || Number.isNaN(from) || Number.isNaN(to) || from === to || from < 1 || to < 1) return;
				const delta = to > from ? 1 : -1;
				ops.change((tree) => {
					let next = tree;
					for (let at = from; at !== to; at += delta) next = moveTab(next, at, delta);
					return next;
				});
				onActive(to);
			}}
		>
			<SortableContext items={tabs.map((_, index) => tabId(index))} strategy={horizontalListSortingStrategy}>
				<FolderTabsList
					aria-label={t("layout.tabs")}
					add={!ops.disabled && <FolderTabsAdd aria-label={t("layout.addTab")} onClick={onAdd} />}
				>
					{tabs.map((_tab, index) =>
						editing === index && index === active ? (
							<FolderTabEdit
								key={tabId(index)}
								data-testid={`tab-${index}`}
								onBlur={(event) => {
									if (!event.currentTarget.contains(event.relatedTarget)) setEditing(null);
								}}
							>
								<InlineName
									value={tabNameOf(site, ops.tree, index)}
									label={t("layout.tabName")}
									disabled={ops.disabled || !tabCanRename(ops.tree, index)}
									maxLength={20}
									onCommit={(name) => ops.change((tree) => renameTab(tree, index, name, defaultName))}
								/>
								{index > 1 && (
									<IconButton
										label={t("layout.upTab", { name: tabNameOf(site, ops.tree, index) })}
										onClick={() => move(index, -1)}
									>
										<ArrowLeft aria-hidden />
									</IconButton>
								)}
								{index > 0 && index < tabs.length - 1 && (
									<IconButton
										label={t("layout.downTab", { name: tabNameOf(site, ops.tree, index) })}
										onClick={() => move(index, 1)}
									>
										<ArrowRight aria-hidden />
									</IconButton>
								)}
								<IconButton
									label={t("layout.removeTab", { name: tabNameOf(site, ops.tree, index) })}
									tone="danger"
									disabled={!tabCanRemove(ops.tree, index)}
									onClick={() => {
										ops.change((tree) => removeTab(tree, index));
										onActive(0);
										setEditing(null);
									}}
								>
									<TrashCan aria-hidden />
								</IconButton>
							</FolderTabEdit>
						) : (
							<SortableTab
								key={tabId(index)}
								ops={ops}
								index={index}
								name={tabNameOf(site, ops.tree, index)}
								count={fieldsInTab(ops.tree, index)}
								editable={index === active && !ops.disabled && tabCanRename(ops.tree, index)}
								onEdit={() => setEditing(index)}
							/>
						),
					)}
				</FolderTabsList>
			</SortableContext>
		</DndContext>
	);
}

/**
 * The fields of the picked tab as the properties panel lays them out: group, then field. Fields are dragged into and out of groups (the row buttons move them to
 * another tab or group without dragging). Every change writes the tree back as the order of `fields` and `layout` together. A field that went is still in the
 * list, struck through, where it was.
 */
function LayoutTree({
	editing,
	ctx,
	site,
	tree,
	activeTab,
	gone,
	showTabs,
}: {
	editing: CollectionEditing;
	ctx: TreeContext;
	site: Site;
	tree: Tree;
	activeTab: number;
	gone: ReturnType<typeof fieldMarks>["gone"];
	showTabs: boolean;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const tc = useTranslator(schemaChangesMessages);
	const { disabled } = useSchemaEdit();
	const placements = placementsOf(site.plugins);
	const collection = editing.collection;
	const change = (next: (tree: Tree) => Tree) =>
		editing.update((current) => withTree(current, next(treeOf(current, placements))));
	const ops: LayoutOps = { change, tree, showTabs, disabled };
	const fields = fieldsOf(collection);
	const at = activeTab;
	const tab = tree.tabs[at];

	const rows: { id: string | null; node: React.ReactNode }[] = [];
	const goneAfter = (name: string | null) => {
		for (const item of gone.filter((one) => one.after === name)) {
			rows.push({
				id: null,
				node: (
					<FieldRow
						key={`gone:${item.name}`}
						data-testid={`gone-${item.name}`}
						removed
						grip={false}
						name={item.name}
						label={item.label}
						note={tc("tag.removed")}
					/>
				),
			});
		}
	};
	const fieldRow = (name: string, depth: 0 | 1, locked: Locked | null) => {
		const here = placeOf(tree, name);
		const inGroup = here !== null && tree.tabs[here.tab]?.blocks[here.block]?.title !== null;
		const destinations: Destination[] = locked
			? []
			: [
					...tree.tabs.flatMap((one, index): Destination[] => {
						const currentTabName = tabNameOf(site, tree, index);
						return [
							...one.blocks.flatMap((block, g): Destination[] =>
								block.title === null
									? []
									: [
											{
												label: showTabs ? `${currentTabName} / ${block.title}` : block.title,
												disabled: here?.tab === index && here.block === g,
												run: () => change((current) => placeField(current, name, index, g)),
											},
										],
							),
							{
								label: showTabs ? `${currentTabName} / ${t("layout.noGroup")}` : t("layout.noGroup"),
								run: () => change((current) => placeUngrouped(current, name, index)),
							},
						];
					}),
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
					depth={depth}
					count={1}
					top={{ member: depth === 1, locked, destinations }}
				/>
			),
		});
		goneAfter(name);
	};

	if (at === 0) {
		for (const name of tree.pinned) fieldRow(name, 0, { kind: "panel" });
		goneAfter(null);
	}
	if (tab) {
		for (const [b, block] of tab.blocks.entries()) {
			if (block.title === null) {
				for (const name of block.fields) fieldRow(name, 0, null);
				continue;
			}
			rows.push({ id: groupId(at, b), node: <GroupRow key={groupId(at, b)} ops={ops} tab={at} block={b} /> });
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
			for (const name of block.fields) fieldRow(name, 1, null);
		}
		rows.push({ id: endId(at), node: <DropRow key={endId(at)} id={endId(at)} testId={`end-${at}`} /> });
		for (const name of tab.locked) fieldRow(name, 0, { kind: "plugin", tab: tab.name });
	}

	return (
		<LayoutDnd ids={rows.flatMap((row) => (row.id === null ? [] : [row.id]))} change={change}>
			<FieldTree aria-label={t("field.title")}>{rows.map((row) => row.node)}</FieldTree>
		</LayoutDnd>
	);
}

const WIDE_QUERY = "(min-width: 1280px)";

/** Whether the window is wide enough for the preview to sit beside the tree. */
export function useWide(): boolean {
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

const PREVIEW_OPEN_CODEC: PreferenceCodec<boolean | null> = {
	parse: (raw) => booleanCodec.parse(raw),
	serialize: (value) => booleanCodec.serialize(value === true),
};

/** Whether the preview is open: remembered in this browser (per device); open on a wide window until the writer closes it. */
export function usePreviewOpen(wide: boolean): [boolean, (open: boolean) => void] {
	const [chosen, setChosen] = usePreference("layout-preview-open", PREVIEW_OPEN_CODEC, null);
	return [chosen ?? wide, setChosen];
}

/**
 * The fields of a collection as the board draws them: the tabs of the properties panel as folder tabs over one aligned list (name, label, kind) of the picked
 * tab, under it the buttons that add a field, a group or a tab, and the legend. A conditional field lists its choices as branches with their own fields under
 * them. A row opens the field in a sheet on the right. What the draft changes is marked in the list. The preview of the panel docks at the window's edge.
 */
export function FieldsCard({ editing }: { editing: CollectionEditing }) {
	const t = useTranslator(schemaFieldsMessages);
	const site = useSite();
	const { disabled, saved, renames } = useSchemaEdit();
	const fields = fieldsOf(editing.collection);
	const [sheet, setSheet] = useState<{ place: FieldPlace; name: string } | null>(null);
	const [adding, setAdding] = useState(false);
	const wide = useWide();
	const [previewOpen, setPreviewOpen] = usePreviewOpen(wide);
	const { file, codeCollections } = useSchemaEdit();
	const placements = placementsOf(site.plugins);
	const tree = treeOf(editing.collection, placements);
	const showTabs = hasTabLevel(tree);
	const [picked, setPicked] = useState(0);
	const active = Math.min(picked, tree.tabs.length - 1);
	const { marks, gone } = useMemo(
		() => fieldMarks(saved, file, renames, editing.collectionName),
		[saved, file, renames, editing.collectionName],
	);
	const ctx: TreeContext = { editing, onOpen: (place, name) => setSheet({ place, name }), marks };
	const addTo = (make: (tree: Tree) => Tree) =>
		editing.update((current) => withTree(current, make(treeOf(current, placements))));
	const unique = (base: string, taken: string[]) => {
		let name = base;
		for (let n = 2; taken.includes(name); n += 1) name = `${base} ${n}`;
		return name;
	};
	const addGroupRow = () =>
		addTo((current) =>
			addGroup(
				current,
				active,
				unique(
					t("layout.newGroup"),
					current.tabs.flatMap((tab) => tab.blocks.flatMap((block) => (block.title === null ? [] : [block.title]))),
				),
			),
		);
	// A plugin's field set (the SEO fields) is offered until the collection has fields with its roles.
	const offeredSets = fieldSetsOf(site.plugins).filter((set) => !hasFieldSet(set, fields));
	const addSet = (set: (typeof offeredSets)[number]) => editing.update((current) => addFieldSet(current, set));
	const addTabRow = () => {
		const defaultName = tabLabel(site, DEFAULT_TAB);
		const name = unique(
			t("layout.newTab"),
			tree.tabs.map((_, at) => tabNameOf(site, tree, at)),
		);
		if (tabProblem(tree, name, undefined, defaultName) !== null) return;
		addTo((current) => addTab(current, name));
		setPicked(tree.tabs.length);
	};
	const ops: LayoutOps = {
		change: (next) => editing.update((current) => withTree(current, next(treeOf(current, placements)))),
		tree,
		showTabs,
		disabled,
	};
	const list =
		Object.keys(fields).length === 0 && gone.length === 0 ? (
			<Text as="p" variant="caption" tone="muted">
				{t("field.none")}
			</Text>
		) : (
			<LayoutTree
				editing={editing}
				ctx={ctx}
				site={site}
				tree={tree}
				activeTab={active}
				gone={gone}
				showTabs={showTabs}
			/>
		);
	return (
		// Under the toolbar: 16 to the tab strip, or 12 to the list when there are no tabs (board "Schema").
		<Stack gap={0} paddingTop={showTabs ? 16 : 12} data-testid="fields-card">
			{showTabs ? (
				<FolderTabs value={String(active)} onValueChange={(value) => setPicked(Number(value))}>
					<TabStrip ops={ops} site={site} active={active} onActive={setPicked} onAdd={addTabRow} />
					<FolderTabsBody value={String(active)}>{list}</FolderTabsBody>
				</FolderTabs>
			) : (
				list
			)}
			<Inline gap={20} paddingY={12}>
				{!disabled && (
					<TextButton type="button" onClick={() => setAdding(true)}>
						+ {t("field.add")}
					</TextButton>
				)}
				{!disabled && (
					<TextButton type="button" quiet onClick={addGroupRow}>
						+ {t("layout.addGroup")}
					</TextButton>
				)}
				{!disabled &&
					offeredSets.map((set) => (
						<TextButton key={`${set.plugin}:${set.id}`} type="button" quiet onClick={() => addSet(set)}>
							+ {t("fields.addSet", { name: set.label })}
						</TextButton>
					))}
				{!disabled && !showTabs && (
					<TextButton type="button" quiet onClick={addTabRow}>
						+ {t("layout.addTab")}
					</TextButton>
				)}
			</Inline>
			<Text as="p" variant="meta" tone="subtle">
				{t("fields.legend")}
			</Text>
			{previewOpen && (
				<DockedPanel>
					<LayoutPreview
						file={file}
						collection={editing.collectionName}
						codeCollections={codeCollections}
						onOpenField={(place, name) => setSheet({ place, name })}
						onClose={() => setPreviewOpen(false)}
					/>
				</DockedPanel>
			)}
			{adding && (
				<AddFieldSheet editing={editing} place={{}} onClose={() => setAdding(false)} onAdded={() => setAdding(false)} />
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
		</Stack>
	);
}
