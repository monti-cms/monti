"use client";

import { DEFAULT_TAB, fieldSetsOf, hasFieldSet, placementsOf, useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, cn, Heading, IconButton, Inline, Stack, Text } from "@monti-cms/ui";
import { Eye, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { booleanCodec, type PreferenceCodec, usePreference } from "../../lib/hooks/use-preference";
import { PanelResizeHandle, usePanelResize } from "../../ui/panel-resize";
import { tabLabel } from "../entries/layout-groups";
import { INSPECTOR_PANEL_RESIZE } from "../shared/side-panel";
import { AddFieldDialog } from "./add-field";
import { useSchemaEdit } from "./controls";
import type { CollectionEditing } from "./field-editor";
import { FieldSheet } from "./field-sheet";
import { schemaFieldsMessages } from "./fields.messages";
import { emptyId, endId, groupId, LayoutDnd, tabId } from "./fields-tree-dnd";
import { DropRow, GroupRow, type LayoutOps, TabRow } from "./fields-tree-layout-rows";
import { columnsOf, type Destination, type Locked, Row, type TreeContext } from "./fields-tree-rows";
import {
	addGroup,
	addTab,
	hasTabLevel,
	moveOutOfGroup,
	placeField,
	placeOf,
	placeUngrouped,
	type Tree,
	tabProblem,
	treeOf,
	withTree,
} from "./layout-model";
import { LayoutPreview } from "./layout-preview";
import { addFieldSet, type FieldPlace, fieldsOf } from "./schema-model";

/**
 * The top-level fields as the properties panel lays them out: tab, then group, then field. Fields are dragged into and out of groups and tabs (the row menus do the
 * same without dragging). Every change writes the tree back as the order of `fields` and `layout` together.
 */
function LayoutTree({ editing, ctx }: { editing: CollectionEditing; ctx: TreeContext }) {
	const t = useTranslator(schemaFieldsMessages);
	const site = useSite();
	const { disabled } = useSchemaEdit();
	const placements = placementsOf(site.plugins);
	const collection = editing.collection;
	const tree = treeOf(collection, placements);
	const showTabs = hasTabLevel(tree);
	const change = (next: (tree: Tree) => Tree) =>
		editing.update((current) => withTree(current, next(treeOf(current, placements))));
	const ops: LayoutOps = { change, tree, showTabs, disabled };
	const fields = fieldsOf(collection);

	const rows: { id: string; node: React.ReactNode }[] = [];
	const fieldRow = (name: string, member: boolean, locked: Locked | null) => {
		const here = placeOf(tree, name);
		const inGroup = here !== null && tree.tabs[here.tab]?.blocks[here.block]?.title !== null;
		const destinations: Destination[] = locked
			? []
			: [
					...tree.tabs.flatMap((tab, at): Destination[] => {
						const currentTabName = at === 0 ? (tree.defaultTab ?? tabLabel(site, tab.name)) : tab.name;
						return [
							...tab.blocks.flatMap((block, g): Destination[] =>
								block.title === null
									? []
									: [
											{
												label: showTabs ? `${currentTabName} / ${block.title}` : block.title,
												disabled: here?.tab === at && here.block === g,
												run: () => change((current) => placeField(current, name, at, g)),
											},
										],
							),
							{
								label: showTabs ? `${currentTabName} / ${t("layout.noGroup")}` : t("layout.noGroup"),
								run: () => change((current) => placeUngrouped(current, name, at)),
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
					prefix=""
					childLead="  "
					nested={false}
					count={1}
					top={{
						member,
						locked,
						destinations,
					}}
				/>
			),
		});
	};

	for (const name of tree.pinned) {
		fieldRow(name, false, { kind: "panel" });
	}
	for (const [at, tab] of tree.tabs.entries()) {
		rows.push({ id: tabId(at), node: <TabRow key={tabId(at)} ops={ops} index={at} /> });
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
		for (const name of tab.locked) fieldRow(name, false, { kind: "plugin", tab: tab.name });
	}

	return (
		<LayoutDnd ids={rows.map((row) => row.id)} change={change}>
			{rows.map((row) => row.node)}
		</LayoutDnd>
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
	const t = useTranslator(schemaFieldsMessages);
	const resize = usePanelResize({ ...INSPECTOR_PANEL_RESIZE, name: "layout-preview", minWidth: 320 });
	return (
		<aside
			aria-label={t("layout.previewTitle")}
			style={resize.style}
			className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-monti-page sm:w-[var(--panel-width)]"
			data-testid="layout-preview-drawer"
		>
			<PanelResizeHandle resize={resize} />
			<Inline shrink={false} justify="between" height="icon-button" border="bottom" paddingX={8}>
				<Heading as="h2" variant="label">
					{t("layout.preview")}
				</Heading>
				<IconButton label={t("layout.previewClose")} onClick={onClose}>
					<X aria-hidden />
				</IconButton>
			</Inline>
			<Stack gap={0} grow minHeight={0} padding={12}>
				{preview}
			</Stack>
		</aside>
	);
}

const PREVIEW_OPEN_CODEC: PreferenceCodec<boolean | null> = {
	parse: (raw) => booleanCodec.parse(raw),
	serialize: (value) => booleanCodec.serialize(value === true),
};

/** Whether the preview is open: remembered in this browser (per device); open on a wide window until the writer closes it. */
function usePreviewOpen(wide: boolean): [boolean, (open: boolean) => void] {
	const [chosen, setChosen] = usePreference("layout-preview-open", PREVIEW_OPEN_CODEC, null);
	return [chosen ?? wide, setChosen];
}

/**
 * The fields of a collection as one aligned tree in a single card: name and label, kind, and the settings in a few words, one line per field. The top-level
 * fields sit in the tabs and groups of the properties panel, with a preview of that panel beside the tree (or in a side panel on a narrower window). A
 * conditional field lists its choices as branches with their own fields under them. A row opens the field in a sheet on the right.
 */
export function FieldsCard({ editing }: { editing: CollectionEditing }) {
	const t = useTranslator(schemaFieldsMessages);
	const site = useSite();
	const { disabled } = useSchemaEdit();
	const fields = fieldsOf(editing.collection);
	const names = Object.keys(fields);
	const [sheet, setSheet] = useState<{ place: FieldPlace; name: string } | null>(null);
	const [adding, setAdding] = useState(false);
	const wide = useWide();
	const [cardRef, cardWidth] = useElementWidth<HTMLDivElement>();
	const showSettings = cardWidth === null || cardWidth >= SETTINGS_MIN_WIDTH;
	const [previewOpen, setPreviewOpen] = usePreviewOpen(wide);
	const sideResize = usePanelResize({ ...INSPECTOR_PANEL_RESIZE, name: "layout-preview-side", minWidth: 320 });
	const { file, codeCollections } = useSchemaEdit();
	const placements = placementsOf(site.plugins);
	const ctx: TreeContext = {
		editing,
		onOpen: (place, name) => setSheet({ place, name }),
		compact: !showSettings,
	};
	const addTo = (make: (tree: Tree) => Tree) =>
		editing.update((current) => withTree(current, make(treeOf(current, placements))));
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
	// A plugin's field set (the SEO fields) is offered until the collection has fields with its roles.
	const offeredSets = fieldSetsOf(site.plugins).filter((set) => !hasFieldSet(set, fields));
	const addSet = (set: (typeof offeredSets)[number]) => editing.update((current) => addFieldSet(current, set));
	const addTabRow = () =>
		addTo((tree) => {
			const defaultName = tabLabel(site, DEFAULT_TAB);
			const name = unique(
				t("layout.newTab"),
				tree.tabs.map((tab, at) => (at === 0 ? (tree.defaultTab ?? defaultName) : tab.name)),
			);
			return tabProblem(tree, name, undefined, defaultName) === null ? addTab(tree, name) : tree;
		});
	const card = (
		<Box maxWidth="content" minWidth={0}>
			<Box ref={cardRef} minWidth={0} overflow="hidden" data-testid="fields-card">
				<Inline wrap justify="between" gap={16} border="bottom" paddingX={16} paddingY={12}>
					<Box minWidth={0}>
						<Heading as="h4" variant="label">
							{t("field.title")} <Text tone="muted">{names.length}</Text>
						</Heading>
						<Text as="p" variant="caption" tone="muted" truncate title={t("fields.hint")}>
							{t("fields.hint")}
						</Text>
					</Box>
					<Inline wrap gap={8}>
						<IconButton label={t("layout.preview")} pressed={previewOpen} onClick={() => setPreviewOpen(!previewOpen)}>
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
						{offeredSets.map((set) => (
							<Button
								key={`${set.plugin}:${set.id}`}
								type="button"
								variant="secondary"
								size="sm"
								disabled={disabled}
								onClick={() => addSet(set)}
							>
								<Plus aria-hidden />
								{t("fields.addSet", { name: set.label })}
							</Button>
						))}
						<Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => setAdding(true)}>
							<Plus aria-hidden />
							{t("field.add")}
						</Button>
					</Inline>
				</Inline>
				<div
					className={cn(
						columnsOf(ctx.compact),
						"border-b py-monti-8 pr-monti-16 pl-monti-32 text-monti-caption text-monti-muted",
					)}
					aria-hidden
				>
					<span>{t("fields.colField")}</span>
					<span>{t("fields.colKind")}</span>
					{!ctx.compact && <span>{t("fields.colSettings")}</span>}
				</div>
				<Box paddingY={8}>
					{names.length === 0 ? (
						<Box paddingX={16} paddingY={12}>
							<Text as="p" variant="caption" tone="muted">
								{t("field.none")}
							</Text>
						</Box>
					) : (
						<LayoutTree editing={editing} ctx={ctx} />
					)}
				</Box>
				<Inline wrap gap={16} border="top" paddingX={16} paddingY={8} align="baseline">
					<Text variant="caption" tone="muted">
						<Text mono tone="warning">
							!
						</Text>{" "}
						{t("fields.legendRequired")}
					</Text>
					<Text variant="caption" tone="muted">
						<Text mono tone="muted">
							→
						</Text>{" "}
						{t("fields.legendRelation")}
					</Text>
					<Text variant="caption" tone="muted">
						<Text mono tone="muted">
							←
						</Text>{" "}
						{t("fields.legendBacklink")}
					</Text>
					<Text variant="caption" tone="muted">
						<Text mono tone="muted">
							= "…"
						</Text>{" "}
						{t("fields.legendOption")}
					</Text>
					<Box as="span" grow />
					<Text variant="caption" tone="muted">
						{t("fields.legendOpen")}
					</Text>
				</Inline>
				{adding && (
					<AddFieldDialog
						editing={editing}
						place={{}}
						onClose={() => setAdding(false)}
						onAdded={() => setAdding(false)}
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
			</Box>
		</Box>
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
					className="grid grid-cols-[minmax(0,1000px)_var(--panel-width)] items-start gap-monti-24"
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
