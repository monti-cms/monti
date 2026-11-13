import { type FieldDefinition, type SchemaProblem, sameJson } from "@monti-cms/core";
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
	TextButton,
	useSortableItem,
} from "@monti-cms/ui";
import { Edit, TrashCan } from "@monti-cms/ui/icons";
import { type ComponentProps, type ReactNode, useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import {
	bandId,
	entriesOf,
	entryIds,
	fieldId,
	isBand,
	isField,
	isGroup,
	isOptionList,
	isTab,
	type Lists,
	listIn,
	listsOf,
	moveAcross,
	moveTab,
	moveToTab,
	moveWithin,
	optionList,
	optionOf,
	removeTab,
	TABS,
	TOP,
	tabId,
	tabIndex,
} from "./layout-moves";
import {
	at,
	type DraftField,
	FIELD_VALUES,
	isUnder,
	type Layout,
	savedField,
	savedOption,
	shownLayout,
} from "./schema-draft";
import type { SettingsDraft } from "./use-settings-draft";

/** The kind at the end of a field's line, as the schema says it: "text · 120", "[] → tag". */
export function kindText(def: FieldDefinition): string {
	if (def.kind === "text") return def.max ? `text · ${def.max}` : "text";
	if (def.kind === "media") return def.accept === "any" ? "media" : "image";
	if (def.kind === "relation") return `${def.many ? "[] " : ""}→ ${def.to}`;
	if (def.kind === "select" && def.many) return "[] select";
	if (def.kind === "conditional") return `conditional · ${def.options.length}`;
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

/**
 * A conditional field with what hangs under it (doc 19): its own line, dragged by its grip, and under it a band for each option with that option's
 * fields. The whole block moves as one.
 */
function SortableBranch({
	id,
	moveLabel,
	children,
	...row
}: RowProps & { id: string; moveLabel: string; children: ReactNode }) {
	const item = useSortableItem(id);
	return (
		<FieldGroup
			ref={item.ref}
			motion={item.motion}
			dragging={item.held}
			head={<FieldRow gripProps={{ ...item.handle, "aria-label": moveLabel }} {...row} />}
		>
			{children}
		</FieldGroup>
	);
}

/**
 * An option's band (doc 19): the first thing of the option's list. It is not dragged (the field's sheet orders the options), and a field
 * dropped on it becomes the option's first.
 */
function OptionBand({ id, ...row }: RowProps & { id: string }) {
	const item = useSortableItem(id);
	return <FieldRow ref={item.ref} group grip={false} {...row} />;
}

/** How deep a line is drawn: the outline has six steps, and anything deeper stands at the last. */
const stepIn = (depth: number) => Math.min(depth, 5) as 0 | 1 | 2 | 3 | 4 | 5;

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
	/** Opens the sheet for a new field; `under` makes it a field of a conditional field's option. */
	onAddField: (under?: { field: string; option: string }) => void;
}) {
	const { t } = useAdmin();
	const { draft, data } = model;
	const locked = data?.locked ?? true;
	// The fields that stand on their own; an option's fields hang under their conditional field (doc 19).
	const keys = model.topFields(c);
	const layoutPath = at.collectionValue(c, "layout");
	// A layout the assistant proposed is the one shown until it is taken or discarded.
	const layout = shownLayout(model.shown(layoutPath) as Layout | undefined, keys, t("settings.fields.defaultTab"));
	const [held, setHeld] = useState<SortableRef | null>(null);
	// While a field is held, the lists as they are shown: it may already sit in another group or option on the way.
	const [preview, setPreview] = useState<Lists | null>(null);
	const [renaming, setRenaming] = useState<number | null>(null);
	const shown = layout;
	// The plugins' tabs stand after the collection's own (doc 14): theirs to fill, so nothing in one is moved, opened or added to.
	const pluginTabs = data?.pluginTabs?.[c] ?? [];
	// Which of them is open is this tab's own to know, apart from the index of the collection's tabs: adding, removing or dragging one of
	// those while a plugin's tab is open leaves it open.
	const [pluginOpen, setPluginOpen] = useState<{ collection: string; index: number } | null>(null);
	const pluginIndex = pluginOpen?.collection === c && pluginOpen.index < pluginTabs.length ? pluginOpen.index : null;
	const pluginTab = pluginIndex === null ? null : (pluginTabs[pluginIndex] ?? null);
	const pluginValue = (index: number) => `plugin:${index}`;
	const current = Math.min(tab, shown.length - 1);
	const entries = shown[current]?.fields ?? [];
	const ids = entryIds(entries);
	const fieldAt = (key: string) => model.shown(at.field(c, key)) as DraftField | null | undefined;
	const optionsOf = (key: string) => {
		const field = fieldAt(key);
		return field?.def.kind === "conditional" ? field.def.options.filter((option) => option !== "") : [];
	};
	// The tab as lists: its top level, its groups, and every option's fields of every conditional field (doc 19).
	const saved: Lists = listsOf(entries);
	for (const key of model.fields(c))
		for (const option of optionsOf(key))
			saved[optionList(key, option)] = model.optionFields(c, key, option).map(fieldId);
	const lists = preview ?? saved;
	/** How deep each line stands, as it was last drawn: the line in hand floats at its own depth. */
	const depths = useRef(new Map<string, number>());

	const setLayout = (next: Layout) => {
		if (JSON.stringify(next) !== JSON.stringify(layout)) draft.set(layoutPath, next);
	};
	const withTab = (base: Layout, fields: Layout[number]["fields"]) =>
		base.map((each, index) => (index === current ? { ...each, fields } : each));

	/**
	 * Keeps what a drag left: the tab's layout, whose option each moved field is (a field put into an option is that option's, one taken out
	 * stands on its own: structure, so not on the live site), and the order of each option's fields (an admin value of the conditional
	 * field, like the layout). `toTab` is a field of an option dropped on another tab's header: it goes to that tab's end.
	 */
	const keep = (next: Lists, toTab?: { tab: number; key: string }) => {
		// The orders of a conditional field's options are one value: every option this drag changed is written into it together.
		const orders = new Map<string, Record<string, string[]>>();
		for (const [list, items] of Object.entries(next)) {
			if (!isOptionList(list)) continue;
			const { host, option } = optionOf(list);
			for (const id of items) {
				if (listIn(saved, id) === list) continue;
				const field = fieldAt(id.slice(2));
				if (field)
					draft.set(at.field(c, id.slice(2)), {
						...field,
						under: { field: host, option: savedOption(fieldAt(host), option) },
					} satisfies DraftField);
			}
			if (!sameJson(items, saved[list] ?? [])) {
				const place = at.fieldValue(c, host, "optionFields");
				const order = orders.get(place) ?? ((model.shown(place) ?? {}) as Record<string, string[]>);
				orders.set(place, { ...order, [option]: items.map((id) => id.slice(2)) });
			}
		}
		for (const [place, order] of orders) draft.set(place, order);
		// A field that left an option for the top level or a group stands on its own.
		for (const [list, items] of Object.entries(saved)) {
			if (!isOptionList(list)) continue;
			for (const id of items) {
				const now = listIn(next, id);
				const field = fieldAt(id.slice(2));
				if (!field || (now !== null && isOptionList(now))) continue;
				const { under: _, ...alone } = field;
				draft.set(at.field(c, id.slice(2)), alone satisfies DraftField);
			}
		}
		const tabs = withTab(layout, entriesOf(next, entries));
		setLayout(
			toTab
				? tabs.map((each, index) => (index === toTab.tab ? { ...each, fields: [...each.fields, toTab.key] } : each))
				: tabs,
		);
	};

	const nameOfField = (key: string) => {
		const field = model.shown(at.field(c, key)) as DraftField | null | undefined;
		return field?.name ?? key;
	};
	const optionLabel = (host: string, option: string) =>
		((model.shown(at.fieldValue(c, host, "optionLabels")) ?? {}) as Record<string, string>)[option] || option;
	const nameOf = (id: string) => {
		if (isField(id)) return nameOfField(id.slice(2));
		if (isTab(id)) return shown[tabIndex(id)]?.tab ?? "";
		if (isBand(id)) {
			const { host, option } = optionOf(`o:${id.slice(2)}`);
			return optionLabel(host, option);
		}
		const entry = entries[ids.indexOf(id)];
		return entry && typeof entry !== "string" ? entry.group : "";
	};
	const accepts = (active: SortableRef, target: SortableRef) => {
		if (target.list === TABS) return active.list === TABS || target.id !== tabId(current);
		if (active.list === TABS) return false;
		if (isGroup(active.id)) return target.list === TOP;
		if (!isOptionList(target.list)) return !(locked && isOptionList(active.list));
		// Into an option: a structure change (not on the live site, where only the order within an option moves), never for the title and
		// the address (every entry has them), and never a conditional field into its own options.
		const key = active.id.slice(2);
		const { host } = optionOf(target.list);
		if (locked && target.list !== active.list) return false;
		if (key === "title" || key === "slug") return false;
		return host !== key && !isUnder((path) => model.shown(path), c, host, key);
	};
	const onOver = ({ active, over, below }: SortableEvent) => {
		if (!over || over.list === TABS || !isField(active.id)) return;
		const next = moveAcross(lists, active.id, over.id, below);
		if (next !== lists) setPreview(next);
	};
	const onDrop = ({ active, over, below }: SortableEvent) => {
		const base = lists;
		setHeld(null);
		setPreview(null);
		if (!over) {
			if (preview) keep(preview);
			return;
		}
		if (active.list === TABS) {
			const from = tabIndex(active.id);
			const to = tabIndex(over.id);
			if (from === to) return;
			setLayout(moveTab(layout, from, to));
			onTab(moveTab([...layout.keys()], from, to).indexOf(current));
			return;
		}
		if (over.list === TABS) {
			// Where it was before the drag began: on the way to the tabs it may have passed through other lists.
			const from = listIn(saved, active.id);
			// A field of an option leaves the option for the other tab; anything else moves as the layout has it.
			if (from !== null && isOptionList(from))
				keep(
					{ ...saved, [from]: (saved[from] as string[]).filter((id) => id !== active.id) },
					{ tab: tabIndex(over.id), key: active.id.slice(2) },
				);
			else setLayout(moveToTab(layout, current, active.id, tabIndex(over.id)));
			return;
		}
		const moved = moveAcross(base, active.id, over.id, below);
		keep(moved !== base ? moved : moveWithin(base, active.id, over.id));
	};

	const problemsOf = (key: string): SchemaProblem[] =>
		model.problems.filter((problem) => problem.collection === c && problem.field === model.fieldName(c, key));

	/** What a field's line shows: its name, label, kind and what changed. */
	const rowProps = (key: string, depth: number) => {
		const path = at.field(c, key);
		const saved = data ? savedField(data, c, key)?.def : undefined;
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
			depth: stepIn(depth),
			changed: mine && Boolean(saved) && !removed,
			changedLabel: t("settings.changed"),
			removed,
			...look,
		};
	};
	/**
	 * What hangs under a conditional field (doc 19): a band for each option, one step in, then that option's fields one step further. A band has
	 * no grip (the field's sheet orders the options, and a band cannot leave its field), its value after its name, and the way to add a field
	 * to it; an option with no fields keeps its band. Each option's fields are a list: they are dragged within it, into another option, and
	 * out to the fields that stand on their own, and one of them may be a conditional field with bands of its own. `still` draws it for the
	 * block in hand: the same lines, none of them a place to drop on.
	 */
	const bands = (key: string, depth: number, still = false): ReactNode[] | null => {
		const field = fieldAt(key);
		if (field?.def.kind !== "conditional") return null;
		return optionsOf(key).map((option) => {
			const list = optionList(key, option);
			const inner = (lists[list] ?? []).map((id) => id.slice(2));
			const label = optionLabel(key, option);
			const named = label !== option;
			const band = {
				depth: stepIn(depth + 1),
				name: label,
				note: named
					? inner.length > 0
						? option
						: `${option} · ${t("settings.fields.noFields")}`
					: inner.length > 0
						? undefined
						: t("settings.fields.noFields"),
				kind:
					locked || still ? undefined : (
						<TextButton
							variant="quiet"
							size="note"
							aria-label={t("settings.fields.addToOption", { option: label })}
							onClick={() => onAddField({ field: key, option })}
						>
							{t("settings.fields.addOptionField")}
						</TextButton>
					),
			};
			if (still)
				return [
					<FieldRow key={`band:${option}`} group grip={false} {...band} />,
					...inner.map((each) => stillRow(each, depth + 2)),
				];
			return (
				<SortableList key={list} id={list} items={[bandId(list), ...inner.map(fieldId)]}>
					<OptionBand id={bandId(list)} {...band} />
					{inner.map((each) => row(each, depth + 2))}
				</SortableList>
			);
		});
	};
	/** A field's line as it floats in the block in hand: with what hangs under it, and nothing to press or drop on. */
	const stillRow = (key: string, depth: number): ReactNode => {
		const props = rowProps(key, depth);
		if (!props) return null;
		const { fieldName: _, removed, ...shownRow } = props;
		const under = removed ? null : bands(key, depth, true);
		return [<FieldRow key={key} {...shownRow} />, ...(under ?? [])];
	};
	const row = (key: string, depth: number): ReactNode => {
		const props = rowProps(key, depth);
		if (!props) return null;
		depths.current.set(key, depth);
		const { fieldName, removed, ...shownRow } = props;
		const under = removed ? null : bands(key, depth);
		if (under)
			return (
				<SortableBranch
					key={key}
					id={fieldId(key)}
					moveLabel={t("settings.fields.move", { name: fieldName })}
					onOpen={() => onOpenField(key)}
					openLabel={t("settings.fields.open", { name: fieldName })}
					{...shownRow}
				>
					{under}
				</SortableBranch>
			);
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
		if (isField(active.id)) {
			const key = active.id.slice(2);
			const depth = depths.current.get(key) ?? 0;
			const props = rowProps(key, depth);
			if (!props) return null;
			const { fieldName: _, removed: __, ...shownRow } = props;
			// A conditional field floats with its options' bands and their fields.
			const under = bands(key, depth, true);
			return under ? (
				<FieldGroup lifted head={<FieldRow {...shownRow} />}>
					{under}
				</FieldGroup>
			) : (
				<FieldRow lifted {...shownRow} />
			);
		}
		const entry = entries[ids.indexOf(active.id)];
		if (!entry || typeof entry === "string") return null;
		return (
			<FieldGroup lifted name={entry.group}>
				{(lists[active.id] ?? []).map((id) => stillRow(id.slice(2), 1))}
			</FieldGroup>
		);
	};

	const groupName = (id: string) => {
		const entry = entries[ids.indexOf(id)];
		return entry && typeof entry !== "string" ? entry.group : "";
	};
	const tree = (
		<SortableList id={TOP} items={lists[TOP] ?? []}>
			<FieldTree>
				{(lists[TOP] ?? []).map((id) =>
					isField(id) ? (
						row(id.slice(2), 0)
					) : (
						<SortableGroup
							key={id}
							id={id}
							name={groupName(id)}
							items={lists[id] ?? []}
							moveLabel={t("settings.fields.move", { name: groupName(id) })}
						>
							{(lists[id] ?? []).map((field) => row(field.slice(2), 1))}
						</SortableGroup>
					),
				)}
			</FieldTree>
		</SortableList>
	);

	const addTab = () => {
		setLayout([...layout, { tab: t("settings.fields.newTab"), fields: [] }]);
		setPluginOpen(null);
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
				<FolderTabs
					value={pluginIndex === null ? String(current) : pluginValue(pluginIndex)}
					onValueChange={(value) => {
						if (String(value).startsWith("plugin:"))
							return setPluginOpen({ collection: c, index: Number(String(value).slice(7)) });
						setPluginOpen(null);
						onTab(Number(value));
					}}
				>
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
							{pluginTabs.map((each, index) => (
								<FolderTab
									key={pluginValue(index)}
									value={pluginValue(index)}
									count={String(each.fields.length)}
									locked
								>
									{each.tab}
								</FolderTab>
							))}
						</FolderTabsList>
					</SortableList>
					{pluginTab ? (
						<FolderTabsBody value={pluginValue(pluginIndex ?? 0)}>
							<FieldTree>
								{pluginTab.fields.map((field) => (
									<FieldRow
										key={field.name}
										grip={false}
										name={field.name}
										label={field.label}
										kind={field.kind}
										locked={t("settings.fields.pluginTab", { plugin: pluginTab.plugin })}
									/>
								))}
							</FieldTree>
						</FolderTabsBody>
					) : (
						<FolderTabsBody value={String(current)}>{tree}</FolderTabsBody>
					)}
				</FolderTabs>
			</Sortable>
			{pluginTab ? (
				// Why nothing here is changed: the tab is a plugin's, set in the site's code.
				<Text as="p" variant="meta" tone="subtle">
					{t("settings.fields.pluginTab", { plugin: pluginTab.plugin })}
				</Text>
			) : (
				<Stack gap={12}>
					<Inline gap={4}>
						{locked ? null : (
							<Button variant="ghost" size="sm" onClick={() => onAddField()}>
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
			)}
		</Stack>
	);
}
