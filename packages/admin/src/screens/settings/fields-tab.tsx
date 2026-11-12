import type { FieldDefinition, SchemaProblem } from "@monti-cms/core";
import {
	Button,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	FieldGroup,
	FieldRow,
	FieldTree,
	FolderTab,
	FolderTabEdit,
	FolderTabLifted,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	Inline,
	Input,
	Sortable,
	type SortableEvent,
	SortableList,
	type SortableRef,
	Stack,
	Text,
	useSortableItem,
} from "@monti-cms/ui";
import { Edit, TrashCan } from "@monti-cms/ui/icons";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import {
	entryIds,
	fieldId,
	isField,
	isGroup,
	isTab,
	itemsOf,
	listOf,
	moveTab,
	moveToTab,
	relocate,
	removeTab,
	reorder,
	TABS,
	TOP,
	tabId,
	tabIndex,
} from "./layout-moves";
import { at, type DraftField, FIELD_VALUES, type Layout, shownLayout } from "./schema-draft";
import type { SettingsDraft } from "./use-settings-draft";

/** The kind at the end of a field's line, as the schema says it: "text · 120", "[] → tag". */
export function kindText(def: FieldDefinition): string {
	if (def.kind === "text") return def.max ? `text · ${def.max}` : "text";
	if (def.kind === "media") return def.accept === "any" ? "media" : "image";
	if (def.kind === "relation") return `${def.many ? "[] " : ""}→ ${def.to}`;
	if (def.kind === "select" && def.many) return "[] select";
	return def.kind;
}

type RowProps = Omit<ComponentProps<typeof FieldRow>, "gripProps" | "motion" | "dragging" | "ref">;

/** A field's line that is dragged by its grip: the whole line moves (list.md, section on dragging). */
function SortableField({ id, moveLabel, ...row }: RowProps & { id: string; moveLabel: string }) {
	const item = useSortableItem(id);
	return (
		<FieldRow
			ref={item.ref}
			gripProps={{ ...item.handle, "aria-label": moveLabel }}
			motion={item.motion}
			dragging={item.held}
			{...row}
		/>
	);
}

/** A group with its fields, dragged by its band's grip as one block; its fields are a list of their own. */
function SortableGroup({
	id,
	name,
	items,
	moveLabel,
	children,
}: {
	id: string;
	name: string;
	items: string[];
	moveLabel: string;
	children: ReactNode;
}) {
	const item = useSortableItem(id);
	return (
		<FieldGroup
			ref={item.ref}
			name={name}
			gripProps={{ ...item.handle, "aria-label": moveLabel }}
			motion={item.motion}
			dragging={item.held}
		>
			<SortableList id={id} items={items}>
				{children}
			</SortableList>
		</FieldGroup>
	);
}

/**
 * One folder tab: dragged by the whole tab, renamed by a double click or the right-click menu, which can also delete it (not the last one). While a
 * field or group is held over it, it shows that it takes it.
 */
function SortableTab({
	index,
	name,
	count,
	target,
	onRename,
	onRemove,
}: {
	index: number;
	name: string;
	count: number;
	target: boolean;
	onRename: () => void;
	onRemove?: () => void;
}) {
	const { t } = useAdmin();
	const item = useSortableItem(tabId(index), { handle: false });
	return (
		<ContextMenu>
			<ContextMenuTrigger>
				<FolderTab
					ref={item.ref}
					{...item.handle}
					value={String(index)}
					count={String(count)}
					motion={item.motion}
					dragging={item.held}
					dropTarget={target && item.over}
					onDoubleClick={onRename}
				>
					{name}
				</FolderTab>
			</ContextMenuTrigger>
			<ContextMenuContent>
				{/* The menu goes with the tab while its name is edited in place, so the field keeps the focus. */}
				<ContextMenuItem onClick={onRename}>
					<Edit />
					{t("settings.fields.renameTab")}
				</ContextMenuItem>
				{onRemove ? (
					<ContextMenuItem variant="danger" onClick={onRemove}>
						<TrashCan />
						{t("settings.fields.removeTab")}
					</ContextMenuItem>
				) : null}
			</ContextMenuContent>
		</ContextMenu>
	);
}

/**
 * The fields tab of a collection (flow 4, steps 03–09; flow 11, step 17): the property panel's tabs, the fields as one outline with what changed on
 * each line, and the buttons that add a field, a group or a tab. A line opens the field's sheet. Fields, groups and tabs are dragged to a new place
 * (list.md, section on dragging: the order changes while they move; a field or group dropped on another tab's header goes to its end). The layout is an
 * admin value, so it moves on the live site too.
 */
export function FieldsTab({
	model,
	collection: c,
	tab,
	onTab,
	onOpenField,
	onAddField,
}: {
	model: SettingsDraft;
	collection: string;
	tab: number;
	onTab: (tab: number) => void;
	onOpenField: (key: string) => void;
	onAddField: () => void;
}) {
	const { t } = useAdmin();
	const { draft, data } = model;
	const locked = data?.locked ?? true;
	const keys = model.fields(c);
	const layoutPath = at.collectionValue(c, "layout");
	// A layout the assistant proposed is the one shown until it is taken or discarded.
	const layout = shownLayout(model.shown(layoutPath) as Layout | undefined, keys, t("settings.fields.defaultTab"));
	const [held, setHeld] = useState<SortableRef | null>(null);
	// While a field is held, the layout as it is shown: it may already sit in another group on the way.
	const [preview, setPreview] = useState<Layout | null>(null);
	const [renaming, setRenaming] = useState<number | null>(null);
	const shown = preview ?? layout;
	const current = Math.min(tab, shown.length - 1);
	const entries = shown[current]?.fields ?? [];
	const ids = entryIds(entries);

	const setLayout = (next: Layout) => {
		if (JSON.stringify(next) !== JSON.stringify(layout)) draft.set(layoutPath, next);
	};
	const withTab = (base: Layout, fields: Layout[number]["fields"]) =>
		base.map((each, index) => (index === current ? { ...each, fields } : each));

	const nameOfField = (key: string) => {
		const field = model.shown(at.field(c, key)) as DraftField | null | undefined;
		return field?.name ?? key;
	};
	const nameOf = (id: string) => {
		if (isField(id)) return nameOfField(id.slice(2));
		if (isTab(id)) return shown[tabIndex(id)]?.tab ?? "";
		const entry = entries[ids.indexOf(id)];
		return entry && typeof entry !== "string" ? entry.group : "";
	};
	const accepts = (active: SortableRef, target: SortableRef) => {
		if (target.list === TABS) return active.list === TABS || target.id !== tabId(current);
		if (active.list === TABS) return false;
		return isGroup(active.id) ? target.list === TOP : true;
	};
	const onOver = ({ active, over, below }: SortableEvent) => {
		if (!over || over.list === TABS || !isField(active.id)) return;
		const next = relocate(entries, active.id, over.id, below);
		if (next !== entries) setPreview(withTab(shown, next));
	};
	const onDrop = ({ active, over, below }: SortableEvent) => {
		const base = shown;
		setHeld(null);
		setPreview(null);
		if (!over) {
			if (preview) setLayout(preview);
			return;
		}
		if (active.list === TABS) {
			const from = tabIndex(active.id);
			const to = tabIndex(over.id);
			if (from === to) return;
			setLayout(moveTab(base, from, to));
			onTab(moveTab([...base.keys()], from, to).indexOf(current));
			return;
		}
		if (over.list === TABS) {
			setLayout(moveToTab(base, current, active.id, tabIndex(over.id)));
			return;
		}
		const moved = relocate(entries, active.id, over.id, below);
		setLayout(withTab(base, moved !== entries ? moved : reorder(entries, active.id, over.id)));
	};

	const problemsOf = (key: string): SchemaProblem[] =>
		model.problems.filter((problem) => problem.collection === c && problem.field === model.fieldName(c, key));

	/** What a field's line shows: its name, label, kind and what changed. */
	const rowProps = (key: string, depth: 0 | 1) => {
		const path = at.field(c, key);
		const saved = data?.schema.collections[c]?.fields[key];
		const cell = draft.cell(path);
		const field = model.shown(path) as DraftField | null | undefined;
		const mine = model.changed.some((changed) => changed === path || changed.startsWith(`fa:${c}:${key}:`));
		const problems = problemsOf(key);
		const removed = field === null;
		// A proposal of the field's admin values alone (its label, its help) marks the line as the field's own proposal does.
		const proposed =
			cell.kind === "proposed" ||
			FIELD_VALUES.some((value) => draft.cell(at.fieldValue(c, key, value)).kind === "proposed");
		const shownField = (field ?? (saved ? { name: key, def: saved } : null)) as DraftField | null;
		if (!shownField) return null;
		const { name, def } = shownField;
		const look = removed
			? { tone: "faint" as const, note: t("settings.fields.removed") }
			: problems[0]
				? { tone: "danger" as const, note: t(`settings.problem.short.${problems[0].code}`) }
				: proposed
					? { tone: "proposal" as const, note: t("settings.fields.proposed") }
					: !saved
						? { tone: "success" as const, note: t("settings.fields.new") }
						: name !== key
							? { tone: "warning" as const, note: `← ${key}` }
							: { tone: "default" as const, note: key === "title" ? t("settings.fields.notInPanel") : undefined };
		return {
			fieldName: name,
			name: def.required ? `${name} !` : name,
			label: (model.shown(at.fieldValue(c, key, "label")) as string | undefined) || undefined,
			description: (model.shown(at.fieldValue(c, key, "description")) as string | undefined) || undefined,
			kind: kindText(def),
			depth,
			changed: mine && Boolean(saved) && !removed,
			changedLabel: t("settings.changed"),
			removed,
			...look,
		};
	};
	const row = (key: string, depth: 0 | 1) => {
		const props = rowProps(key, depth);
		if (!props) return null;
		const { fieldName, removed, ...shownRow } = props;
		return (
			<SortableField
				key={key}
				id={fieldId(key)}
				moveLabel={t("settings.fields.move", { name: fieldName })}
				onOpen={removed ? undefined : () => onOpenField(key)}
				openLabel={t("settings.fields.open", { name: fieldName })}
				{...shownRow}
			/>
		);
	};
	/** The thing in hand as it floats over the page: the same line, group (with its fields) or tab. */
	const lifted = (active: SortableRef) => {
		if (isTab(active.id)) {
			const index = tabIndex(active.id);
			return <FolderTabLifted count={String(count(index))}>{shown[index]?.tab}</FolderTabLifted>;
		}
		const still = (key: string, depth: 0 | 1) => {
			const props = rowProps(key, depth);
			if (!props) return null;
			const { fieldName: _, removed: __, ...shownRow } = props;
			return shownRow;
		};
		if (isField(active.id)) {
			const shownRow = still(active.id.slice(2), listOf(entries, active.id) === TOP ? 0 : 1);
			return shownRow ? <FieldRow lifted {...shownRow} /> : null;
		}
		const entry = entries[ids.indexOf(active.id)];
		if (!entry || typeof entry === "string") return null;
		return (
			<FieldGroup lifted name={entry.group}>
				{entry.fields.map((key) => {
					const shownRow = still(key, 1);
					return shownRow ? <FieldRow key={key} {...shownRow} /> : null;
				})}
			</FieldGroup>
		);
	};

	const tree = (
		<SortableList id={TOP} items={ids}>
			<FieldTree>
				{entries.map((entry, index) => {
					const id = ids[index] as string;
					return typeof entry === "string" ? (
						row(entry, 0)
					) : (
						<SortableGroup
							key={id}
							id={id}
							name={entry.group}
							items={itemsOf(entries, id)}
							moveLabel={t("settings.fields.move", { name: entry.group })}
						>
							{entry.fields.map((key) => row(key, 1))}
						</SortableGroup>
					);
				})}
			</FieldTree>
		</SortableList>
	);

	const addTab = () => {
		setLayout([...layout, { tab: t("settings.fields.newTab"), fields: [] }]);
		onTab(layout.length);
		setRenaming(layout.length);
	};
	/** Keeps a tab's new name (Enter, or leaving the field); an empty or unchanged name keeps the old one. */
	const renameTab = (index: number, value: string) => {
		if (renaming !== index) return;
		const name = value.trim();
		if (name && name !== layout[index]?.tab)
			setLayout(layout.map((one, at) => (at === index ? { ...one, tab: name } : one)));
		setRenaming(null);
	};
	const deleteTab = (index: number) => {
		setLayout(removeTab(layout, index));
		onTab(current === index ? 0 : current > index ? current - 1 : current);
	};
	const addGroup = () =>
		setLayout(
			layout.map((each, index) =>
				index === current
					? { ...each, fields: [...each.fields, { group: t("settings.fields.newGroup"), fields: [] }] }
					: each,
			),
		);
	const count = (index: number) =>
		shown[index]?.fields.reduce<number>(
			(sum, entry) => sum + (typeof entry === "string" ? 1 : entry.fields.length),
			0,
		) ?? 0;
	const holdsField = held !== null && held.list !== TABS;

	return (
		<Stack gap={12} paddingTop={16}>
			<Sortable
				nameOf={nameOf}
				accepts={accepts}
				onStart={setHeld}
				onOver={onOver}
				onDrop={onDrop}
				onCancel={() => {
					setHeld(null);
					setPreview(null);
				}}
				overlay={lifted}
			>
				<FolderTabs value={String(current)} onValueChange={(value) => onTab(Number(value))}>
					<SortableList
						id={TABS}
						direction="horizontal"
						items={shown.flatMap((_, index) => (index === renaming ? [] : [tabId(index)]))}
					>
						<FolderTabsList
							add={
								locked ? undefined : (
									<FolderTabsAdd aria-label={t("settings.fields.addTab")} onClick={addTab}>
										+
									</FolderTabsAdd>
								)
							}
						>
							{shown.map((each, index) =>
								renaming === index ? (
									<FolderTabEdit key={tabId(index)}>
										<Input
											appearance="inline"
											width="fit"
											aria-label={t("settings.fields.tabName")}
											defaultValue={each.tab}
											autoFocus
											onBlur={(event) => renameTab(index, event.currentTarget.value)}
											onKeyDown={(event) => {
												if (event.key === "Enter") renameTab(index, event.currentTarget.value);
												if (event.key === "Escape") setRenaming(null);
											}}
										/>
									</FolderTabEdit>
								) : (
									<SortableTab
										key={tabId(index)}
										index={index}
										name={each.tab}
										count={count(index)}
										target={holdsField && index !== current}
										onRename={() => setRenaming(index)}
										onRemove={shown.length > 1 ? () => deleteTab(index) : undefined}
									/>
								),
							)}
						</FolderTabsList>
					</SortableList>
					<FolderTabsBody value={String(current)}>{tree}</FolderTabsBody>
				</FolderTabs>
			</Sortable>
			<Stack gap={12}>
				<Inline gap={4}>
					{locked ? null : (
						<Button variant="ghost" size="sm" onClick={onAddField}>
							{t("settings.fields.addField")}
						</Button>
					)}
					<Button variant="ghost" size="sm" onClick={addGroup}>
						{t("settings.fields.addGroup")}
					</Button>
				</Inline>
				<Text as="p" variant="meta" tone="subtle">
					{t("settings.fields.legend")}
				</Text>
			</Stack>
		</Stack>
	);
}
