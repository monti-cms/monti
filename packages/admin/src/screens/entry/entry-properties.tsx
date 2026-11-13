import {
	type ConditionalField,
	type FieldDefinition,
	type FieldMark,
	inOptionOrder,
	localeModeOf,
	slugify,
	storedFields,
} from "@monti-cms/core";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	DragHandle,
	FormField,
	FormFieldLabel,
	FormFieldWas,
	IconButton,
	Inline,
	Input,
	List,
	Option,
	OrderedRow,
	PropertyGroup,
	PropertyPanel,
	Sortable,
	SortableList,
	Stack,
	Switch,
	Text,
	Textarea,
	useComboboxAnchor,
	useSortableItem,
} from "@monti-cms/ui";
import { Close, Renew } from "@monti-cms/ui/icons";
import { useMemo, useState } from "react";
import type { FieldUploads } from "../../media/use-field-uploads";
import { useAdmin } from "../../operations/admin-context";
import { PickOne } from "../settings/pick-one";
import { type Layout, type SchemaRead, shownLayout } from "../settings/schema-draft";
import { MediaField, SharedMediaValue } from "./media-field";
import { FieldChange } from "./translation";
import type { EntryEditorModel } from "./use-entry-editor";
import { useRelationField } from "./use-relation-field";

/** Whether a field holds something: an empty text or an empty list is no value. */
const hasValue = (value: unknown) =>
	value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

/** The id of a field's input: a to-do row puts the cursor there. */
export const fieldInputId = (field: string) => `monti-entry-${field}`;

/** The kinds of field the panel holds. */
const SHOWN = new Set<FieldDefinition["kind"]>(["text", "slug", "select", "relation", "media", "conditional"]);

/** The fields of a collection the panel shows, in the schema's order. The title is the editor's heading, not a property (flow 1). */
export function panelFields(schema: SchemaRead | null, collection: string) {
	const fields = schema?.schema.collections[collection]?.fields ?? {};
	return Object.entries(fields)
		.filter(([key, def]) => key !== "title" && SHOWN.has(def.kind))
		.map(([key]) => key);
}

/** The tabs of the panel: the collection's layout (doc 01), the fields it leaves out in its first tab. */
export function panelLayout(schema: SchemaRead | null, collection: string, defaultTab: string): Layout {
	const layout = schema?.adminValues[collection]?.layout as Layout | undefined;
	return shownLayout(layout, panelFields(schema, collection), defaultTab).filter((tab) => tab.fields.length > 0);
}

/** Where a field's value is in the editor's draft: the address is the entry's own, the rest are its values. */
export const fieldPath = (field: string) => (field === "slug" ? "slug" : `values.${field}`);

/** A tab's entries as the panel groups them: loose fields between groups run together, each group under its name. */
function runs(entries: Layout[number]["fields"]) {
	const out: { key: string; title?: string; fields: string[] }[] = [];
	for (const entry of entries) {
		if (typeof entry !== "string") out.push({ key: `group:${entry.group}`, title: entry.group, fields: entry.fields });
		else {
			const last = out.at(-1);
			if (last && last.title === undefined) last.fields.push(entry);
			else out.push({ key: `run:${entry}`, fields: [entry] });
		}
	}
	return out;
}

/** A select that holds many values: the picked ones as chips, the input after them to add more. */
function PickMany({
	id,
	items,
	value,
	onChange,
	placeholder,
	disabled,
	proposal,
}: {
	id: string;
	items: { value: string; label: string }[];
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
	disabled: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
}) {
	const { t } = useAdmin();
	const anchor = useComboboxAnchor();
	const label = (option: string) => items.find((item) => item.value === option)?.label ?? option;
	return (
		<Combobox
			items={items.map((item) => item.value)}
			multiple
			value={value}
			onValueChange={(next) => onChange(next as string[])}
			itemToStringLabel={(option: string) => label(option)}
			disabled={disabled}
		>
			<ComboboxChips ref={anchor} size="md" proposal={proposal}>
				{value.map((option) => (
					<ComboboxChip key={option}>{label(option)}</ComboboxChip>
				))}
				<ComboboxChipsInput id={id} placeholder={value.length === 0 ? placeholder : undefined} />
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
				<ComboboxList>
					{(option: string) => (
						<ComboboxItem key={option} value={option}>
							{label(option)}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

/** What a pick shows as: its option's name, a comma between several. */
function pickNames(value: unknown, labels: Record<string, string> = {}) {
	return (Array.isArray(value) ? value : value === undefined ? [] : [value])
		.map((each) => labels[String(each)] ?? String(each))
		.join(", ");
}

/** In a translation where the field is shared, resolves relation group IDs to titles. */
function SharedRelationValue({
	collection,
	field,
	locale,
	value,
	empty,
}: {
	collection: string;
	field: string;
	locale: string;
	value: unknown;
	empty: string;
}) {
	const rel = useRelationField({ collection, field, locale });
	const raw = Array.isArray(value) ? value : value ? [value] : [];
	const shown = raw
		.map((item) => rel.labelOf(String(item)))
		.filter(Boolean)
		.join(", ");
	return (
		<Text variant="note" tone={shown ? undefined : "faint"}>
			{shown || empty}
		</Text>
	);
}

function SortableOrderedRow({
	id,
	label,
	onRemove,
	removeLabel,
	moveLabel,
	disabled,
	proposal,
}: {
	id: string;
	label: string;
	onRemove: () => void;
	removeLabel: string;
	moveLabel: string;
	disabled?: boolean;
	/** The row is of a value the assistant proposed: its words are blue, as a proposed input's. */
	proposal?: boolean;
}) {
	const item = useSortableItem(id, { disabled });
	return (
		<OrderedRow
			ref={item.ref}
			handle={<DragHandle {...item.handle} aria-label={moveLabel} />}
			drag={{ ...item.motion, active: item.held }}
			actions={
				!disabled && (
					<IconButton size="xs" variant="ghost" label={removeLabel} onClick={onRemove}>
						<Close aria-hidden />
					</IconButton>
				)
			}
		>
			<Text tone={proposal ? "proposal" : undefined}>{label}</Text>
		</OrderedRow>
	);
}

function RelationSingleInput({
	id,
	collection,
	field,
	locale,
	entryGroup,
	createMissing,
	required,
	value,
	onChange,
	placeholder,
	disabled,
	proposal,
}: {
	id: string;
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
	required?: boolean;
	value: string | null;
	onChange: (value: string | null) => void;
	placeholder: string;
	disabled: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
}) {
	const { t } = useAdmin();
	const rel = useRelationField({ collection, field, locale, entryGroup, createMissing });

	const items = useMemo(() => {
		const list = rel.options.map((o) => o.group);
		if (rel.createToken) list.push(rel.createToken);
		return list;
	}, [rel.options, rel.createToken]);

	return (
		<Combobox
			items={items}
			value={value}
			onValueChange={(next) => {
				onChange(next ? String(next) : null);
				rel.setSearch("");
			}}
			inputValue={rel.search}
			onInputValueChange={rel.setSearch}
			itemToStringLabel={(item) =>
				item === null ? "" : item === rel.createToken ? (rel.createLabel ?? item) : rel.labelOf(item)
			}
			disabled={disabled}
		>
			<ComboboxInput
				id={id}
				size="md"
				placeholder={placeholder}
				showClear={!required && Boolean(value)}
				proposal={proposal}
			/>
			<ComboboxContent>
				<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
				<ComboboxList>
					{(group: string) => {
						const isCreate = group === rel.createToken;
						if (isCreate) {
							return (
								<ComboboxItem key={group} value={group}>
									{rel.createLabel}
								</ComboboxItem>
							);
						}
						const opt = rel.allOptions.find((o) => o.group === group);
						const unpublished = rel.targetKind === "document" && opt && !opt.published;
						return (
							<ComboboxItem key={group} value={group}>
								{rel.labelOf(group)}
								{unpublished && (
									<Text variant="micro" tone="subtle">
										({t("relations.unpublished")})
									</Text>
								)}
							</ComboboxItem>
						);
					}}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

function RelationManyInput({
	id,
	collection,
	field,
	locale,
	entryGroup,
	createMissing,
	value,
	onChange,
	placeholder,
	disabled,
	proposal,
}: {
	id: string;
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
	disabled: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
}) {
	const { t } = useAdmin();
	const anchor = useComboboxAnchor();
	const rel = useRelationField({ collection, field, locale, entryGroup, createMissing });

	const items = useMemo(() => {
		const list = rel.options.map((o) => o.group).filter((g) => !value.includes(g));
		if (rel.createToken && !value.includes(rel.createToken)) list.push(rel.createToken);
		return list;
	}, [rel.options, rel.createToken, value]);

	return (
		<Combobox
			items={items}
			multiple
			value={value}
			onValueChange={(next) => {
				onChange(next as string[]);
				rel.setSearch("");
			}}
			inputValue={rel.search}
			onInputValueChange={rel.setSearch}
			itemToStringLabel={(item) =>
				item === null ? "" : item === rel.createToken ? (rel.createLabel ?? item) : rel.labelOf(item)
			}
			disabled={disabled}
		>
			<ComboboxChips ref={anchor} size="md" proposal={proposal}>
				{value.map((item) => (
					// A field that cannot be changed offers no way to take a value out.
					<ComboboxChip key={item} showRemove={!disabled}>
						{rel.labelOf(item)}
					</ComboboxChip>
				))}
				<ComboboxChipsInput id={id} placeholder={value.length === 0 ? placeholder : undefined} />
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
				<ComboboxList>
					{(group: string) => {
						const isCreate = group === rel.createToken;
						if (isCreate) {
							return (
								<ComboboxItem key={group} value={group}>
									{rel.createLabel}
								</ComboboxItem>
							);
						}
						const opt = rel.allOptions.find((o) => o.group === group);
						const unpublished = rel.targetKind === "document" && opt && !opt.published;
						return (
							<ComboboxItem key={group} value={group}>
								{rel.labelOf(group)}
								{unpublished && (
									<Text variant="micro" tone="subtle">
										({t("relations.unpublished")})
									</Text>
								)}
							</ComboboxItem>
						);
					}}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

function RelationOrderedManyInput({
	id,
	collection,
	field,
	locale,
	entryGroup,
	createMissing,
	value,
	onChange,
	placeholder,
	disabled,
	proposal,
}: {
	id: string;
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
	disabled: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
}) {
	const { t } = useAdmin();
	const rel = useRelationField({ collection, field, locale, entryGroup, createMissing });

	const selectableOptions = useMemo(() => {
		const list = rel.options.map((o) => o.group).filter((g) => !value.includes(g));
		if (rel.createToken && !value.includes(rel.createToken)) list.push(rel.createToken);
		return list;
	}, [rel.options, rel.createToken, value]);

	return (
		<Stack gap={8}>
			<Combobox
				items={selectableOptions}
				value={null}
				onValueChange={(next) => {
					if (next) {
						onChange([...value, String(next)]);
						rel.setSearch("");
					}
				}}
				inputValue={rel.search}
				onInputValueChange={rel.setSearch}
				itemToStringLabel={(item) =>
					item === null ? "" : item === rel.createToken ? (rel.createLabel ?? item) : rel.labelOf(item)
				}
				disabled={disabled}
			>
				<ComboboxInput id={id} size="md" placeholder={placeholder} showClear={false} proposal={proposal} />
				<ComboboxContent>
					<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
					<ComboboxList>
						{(group: string) => {
							const isCreate = group === rel.createToken;
							if (isCreate) {
								return (
									<ComboboxItem key={group} value={group}>
										{rel.createLabel}
									</ComboboxItem>
								);
							}
							const opt = rel.allOptions.find((o) => o.group === group);
							const unpublished = rel.targetKind === "document" && opt && !opt.published;
							return (
								<ComboboxItem key={group} value={group}>
									{rel.labelOf(group)}
									{unpublished && (
										<Text variant="micro" tone="subtle">
											({t("relations.unpublished")})
										</Text>
									)}
								</ComboboxItem>
							);
						}}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
			{value.length > 0 && (
				<Sortable
					nameOf={(item) => rel.labelOf(String(item))}
					onDrop={({ active, over }) => {
						if (!over) return;
						const from = value.indexOf(String(active.id));
						const to = value.indexOf(String(over.id));
						if (from === -1 || to === -1 || from === to) return;
						const next = [...value];
						const [moved] = next.splice(from, 1);
						if (moved) next.splice(to, 0, moved);
						onChange(next);
					}}
					overlay={(active) => (
						<OrderedRow drag={{ active: true }} handle={<DragHandle aria-hidden tabIndex={-1} />}>
							<Text>{rel.labelOf(String(active.id))}</Text>
						</OrderedRow>
					)}
				>
					<SortableList id={id} items={value}>
						<List marker="none">
							{value.map((item) => (
								<SortableOrderedRow
									key={item}
									id={item}
									label={rel.labelOf(item)}
									moveLabel={t("relations.move", { title: rel.labelOf(item) })}
									removeLabel={t("relations.remove")}
									onRemove={() => onChange(value.filter((g) => g !== item))}
									disabled={disabled}
									proposal={proposal}
								/>
							))}
						</List>
					</SortableList>
				</Sortable>
			)}
		</Stack>
	);
}

/**
 * The entry's properties (editor.md, the property panel): the collection's fields in its tabs and groups, each an input from the start. The tab is the screen's,
 * so a to-do row can open the tab its field is in.
 */
export function EntryProperties({
	editor,
	schema,
	collection,
	tab,
	onTab,
	readOnly,
	shared,
	uploads,
	altCard,
	onAltCard,
	changes,
}: {
	editor: EntryEditorModel;
	schema: SchemaRead | null;
	collection: string;
	tab: number;
	onTab: (tab: number) => void;
	readOnly: boolean;
	/** In a translation, the source's field values: a field that is the same in every language shows the source's, read only (doc 04). */
	shared?: Record<string, unknown> | null;
	/** The files going up for the media fields: the editor's, so they outlive this panel. */
	uploads: FieldUploads;
	/** The media field whose picture settings are open: a to-do row opens them. */
	altCard: string | null;
	onAltCard: (field: string | null) => void;
	/** In a translation: the fields whose source moved on (T111), and confirming one. */
	changes?: { marks: readonly FieldMark[]; onConfirm: (field: string) => void };
}) {
	const { t } = useAdmin();
	const [focused, setFocused] = useState<string | null>(null);
	const top = schema?.schema.collections[collection]?.fields ?? {};
	// A conditional field (doc 19) is its choice and, under it, the fields of the chosen option: each is stored as a field of its own.
	const definitions = storedFields(schema?.schema.collections[collection]);
	const values = schema?.adminValues[collection]?.fields ?? {};
	const layout = panelLayout(schema, collection, t("entry.defaultTab"));
	const picked = layout[tab] ?? layout[0];
	const keys = panelFields(schema, collection);
	// A red * only in a panel that also has fields that may stay empty (components/field.md, required fields).
	const marksRequired = keys.some((key) => !definitions[key]?.required);
	// An empty address always blocks publishing (doc 02), whatever the schema says.
	const required = (key: string) => key === "slug" || Boolean(definitions[key]?.required);
	const empty = t("entry.empty");
	const entry = editor.loaded && "entry" in editor.loaded ? editor.loaded.entry : null;
	const currentLocale = entry?.locale;
	const entryGroup = entry?.translationGroup;

	const row = (key: string, after?: React.ReactNode) => {
		const def = definitions[key];
		if (!def) return null;
		const id = fieldInputId(key);
		const path = fieldPath(key);
		// A value the assistant proposed for this field and nobody has taken yet (doc 05; T86): it is in the input, blue, and what the
		// entry holds is struck through under it. Changing it takes the proposal first; "discard" on the label row leaves the field as it is.
		const state = readOnly ? null : editor.draft.cell(path);
		const proposed = state?.kind === "proposed" ? state : null;
		const held = editor.value(path);
		const value = proposed ? proposed.value : held;
		const text = typeof value === "string" ? value : "";
		const proposal = proposed !== null;
		const proposedLabel = proposed
			? {
					label: t("ui.proposal"),
					tone: "proposal" as const,
					undoLabel: t("settings.discard"),
					undoName: t("entry.proposal.discard", { field: values[key]?.label ?? key }),
					onUndo: () => void editor.draft.discard(proposed.item.id),
				}
			: undefined;
		// What the field holds now, in words, when words say it: a text, an address, a pick. A file or a related item has no name here.
		const heldWords =
			def.kind === "select"
				? pickNames(held, values[key]?.optionLabels)
				: (def.kind === "text" || def.kind === "slug") && typeof held === "string"
					? held
					: "";
		const was = proposed && heldWords ? <FormFieldWas>{heldWords}</FormFieldWas> : null;
		const count =
			// Not while a proposal waits in the field: its label row holds the proposal's dot and "discard" (screens/editor.md).
			def.kind === "text" && def.max !== undefined && focused === key && !proposed ? (
				<Text variant="micro" tone="subtle">
					{t("entry.count", { count: text.length, max: def.max })}
				</Text>
			) : undefined;
		const focus = { onFocus: () => setFocused(key), onBlur: () => setFocused(null) };
		const changeMark = changes?.marks.find((mark) => mark.field === key);
		const shownInCard = (shownValue: unknown) =>
			def.kind === "media" ? (
				<SharedMediaValue value={shownValue} empty={empty} withAlt />
			) : (
				pickNames(shownValue, values[key]?.optionLabels)
			);
		const change = changeMark ? (
			<FieldChange
				mark={changeMark}
				shown={def.kind === "text" ? undefined : shownInCard}
				onConfirm={() => changes?.onConfirm(key)}
			/>
		) : undefined;
		// In a translation a field that is the same in every language is the source's: its value, read only (editor.md, a value no one changes here).
		if (shared && localeModeOf(key, def) === "same") {
			const sourceNote = (
				<Text variant="micro" tone="faint">
					{t("translation.sharedField")}
				</Text>
			);
			if (def.kind === "media")
				return (
					<FormField key={key}>
						<FormFieldLabel action={sourceNote}>{values[key]?.label ?? key}</FormFieldLabel>
						<SharedMediaValue value={shared[key]} empty={empty} />
					</FormField>
				);
			if (def.kind === "relation") {
				return (
					<FormField key={key}>
						<FormFieldLabel action={sourceNote}>{values[key]?.label ?? key}</FormFieldLabel>
						<SharedRelationValue
							collection={collection}
							field={key}
							locale={currentLocale ?? ""}
							value={shared[key]}
							empty={empty}
						/>
					</FormField>
				);
			}
			// A choice made by a switch reads as what the switch says: on or off, never the option's word.
			const shown =
				def.kind === "select" && def.control === "toggle"
					? t(shared[key] === def.options[0] ? "entry.toggleOn" : "entry.toggleOff")
					: pickNames(shared[key], values[key]?.optionLabels);
			return (
				<FormField key={key}>
					<FormFieldLabel action={sourceNote}>{values[key]?.label ?? key}</FormFieldLabel>
					<Text variant="note" tone={shown ? undefined : "faint"}>
						{shown || empty}
					</Text>
				</FormField>
			);
		}
		if (def.kind === "media")
			return (
				<MediaField
					key={key}
					id={id}
					field={key}
					uploads={uploads}
					card={altCard === key}
					onCard={(open) => onAltCard(open ? key : null)}
					label={values[key]?.label ?? key}
					required={marksRequired && required(key)}
					accept={def.accept}
					change={change}
					proposed={proposedLabel}
					value={value}
					// A translation's empty field follows the source's (doc 09): what shows is that file, until it has its own.
					source={localeModeOf(key, def) === "fromSource" ? shared?.[key] : undefined}
					// × says what it does, as on any field: what follows (the source's file and the follows-source label) shows at once (2026-11-10, owner).
					following={shared && localeModeOf(key, def) === "fromSource" ? t("translation.followsSource") : undefined}
					readOnly={readOnly}
					onChange={(next) => editor.set(path, next)}
				/>
			);
		// A choice with one option, on or off (doc 19): a switch at the end of the field's row, the way every switch stands.
		if (def.kind === "select" && def.control === "toggle") {
			const [on] = def.options;
			return (
				<FormField key={key}>
					<Option spread height="md">
						{values[key]?.label ?? key}
						<Switch
							id={id}
							checked={value === on}
							disabled={readOnly}
							// A choice the assistant proposed and nobody has taken: the switch stands as proposed, in the proposal's blue.
							proposal={proposal}
							onCheckedChange={(checked) => editor.set(path, checked ? on : null)}
						/>
					</Option>
					{after}
				</FormField>
			);
		}
		const strays =
			def.kind === "select"
				? (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).filter(
						(option): option is string => typeof option === "string" && !def.options.includes(option),
					)
				: [];
		const input = () => {
			if (def.kind === "slug")
				return (
					<Input
						id={id}
						size="md"
						mono
						value={text}
						placeholder={empty}
						disabled={readOnly}
						proposal={proposal}
						onChange={(event) => editor.set(path, event.target.value)}
						action={
							readOnly || editor.title.trim() === "" ? undefined : (
								<IconButton label={t("entry.slugAgain")} onClick={() => editor.set(path, slugify(editor.title))}>
									<Renew aria-hidden />
								</IconButton>
							)
						}
					/>
				);
			if (def.kind === "text")
				return def.multiline ? (
					<Textarea
						id={id}
						size="md"
						value={text}
						placeholder={empty}
						maxLength={def.max}
						disabled={readOnly}
						proposal={proposal}
						onChange={(event) => editor.set(path, event.target.value)}
						{...focus}
					/>
				) : (
					<Input
						id={id}
						size="md"
						value={text}
						placeholder={empty}
						maxLength={def.max}
						disabled={readOnly}
						proposal={proposal}
						onChange={(event) => editor.set(path, event.target.value)}
						{...focus}
					/>
				);
			if (def.kind === "select") {
				const labels = values[key]?.optionLabels ?? {};
				// A stored word the field no longer lists (older data, a schema file edited by hand) is shown as it is, never as another option.
				const items = [...def.options, ...strays].map((option) => ({ value: option, label: labels[option] ?? option }));
				return def.many ? (
					<PickMany
						id={id}
						items={items}
						value={Array.isArray(value) ? (value as string[]) : []}
						onChange={(next) => editor.set(path, next)}
						placeholder={empty}
						disabled={readOnly}
						proposal={proposal}
					/>
				) : (
					<PickOne
						id={id}
						size="md"
						items={items}
						value={typeof value === "string" ? value : null}
						onChange={(next) => editor.set(path, next)}
						placeholder={empty}
						disabled={readOnly}
						proposal={proposal}
					/>
				);
			}
			if (def.kind === "relation") {
				if (def.many && def.ordered) {
					return (
						<RelationOrderedManyInput
							id={id}
							collection={collection}
							field={key}
							locale={currentLocale}
							entryGroup={entryGroup}
							createMissing={def.createMissing}
							value={Array.isArray(value) ? (value as string[]) : []}
							onChange={(next) => editor.set(path, next)}
							placeholder={empty}
							disabled={readOnly}
							proposal={proposal}
						/>
					);
				}
				if (def.many) {
					return (
						<RelationManyInput
							id={id}
							collection={collection}
							field={key}
							locale={currentLocale}
							entryGroup={entryGroup}
							createMissing={def.createMissing}
							value={Array.isArray(value) ? (value as string[]) : []}
							onChange={(next) => editor.set(path, next)}
							placeholder={empty}
							disabled={readOnly}
							proposal={proposal}
						/>
					);
				}
				return (
					<RelationSingleInput
						id={id}
						collection={collection}
						field={key}
						locale={currentLocale}
						entryGroup={entryGroup}
						createMissing={def.createMissing}
						required={def.required}
						value={typeof value === "string" ? value : null}
						onChange={(next) => editor.set(path, next)}
						placeholder={empty}
						disabled={readOnly}
						proposal={proposal}
					/>
				);
			}
			return null;
		};
		return (
			<FormField key={key}>
				<FormFieldLabel
					htmlFor={id}
					required={marksRequired && required(key)}
					changed={proposedLabel}
					// While a proposal waits the row is the proposal's alone: no count, no mark of the source's change beside "discard".
					action={
						proposedLabel ? undefined : change && count ? (
							<Inline gap={8}>
								{count}
								{change}
							</Inline>
						) : (
							(change ?? count)
						)
					}
				>
					{values[key]?.label ?? key}
				</FormFieldLabel>
				{input()}
				{was}
				{strays.length > 0 ? (
					<Text variant="caption" tone="warning">
						{t("entry.notAnOption", { option: strays.join(", ") })}
					</Text>
				) : null}
				{after}
			</FormField>
		);
	};

	/** Every field under an option, however deep: the fields of its conditional fields' options too. */
	const allUnder = (group: ConditionalField["fields"][string]): string[] =>
		Object.entries(group).flatMap(([name, inner]) => [
			name,
			...(inner.kind === "conditional" ? Object.values(inner.fields).flatMap(allUnder) : []),
		]);
	/**
	 * A field's rows: itself and, for a conditional field, the chosen option's fields directly under the choice. One of those may be a
	 * conditional field too: its chosen option's fields follow it the same way.
	 */
	const rowsOf = (key: string, field: FieldDefinition | undefined): React.ReactNode[] => {
		if (field?.kind !== "conditional") return [row(key)];
		const sameAsSource = shared && localeModeOf(key, field) === "same";
		const chosen = sameAsSource ? shared[key] : editor.value(`values.${key}`);
		// The values the other options still hold are dropped by the save (doc 19): said under the choice until then.
		const left = Object.entries(field.fields)
			.filter(([option]) => option !== chosen)
			.map(([option, group]) => ({
				option,
				count: allUnder(group).filter((inner) => hasValue(editor.value(`values.${inner}`))).length,
			}))
			.filter((each) => each.count > 0);
		const labels = values[key]?.optionLabels ?? {};
		const lost =
			left.length > 0 && !sameAsSource ? (
				<Text variant="caption" tone="warning">
					{/* A switch has one option: what goes is that field's own, named by the field. */}
					{t("entry.clearedOnSave", {
						option:
							field.control === "toggle"
								? (values[key]?.label ?? key)
								: left.map((each) => labels[each.option] ?? each.option).join(", "),
						count: left.reduce((sum, each) => sum + each.count, 0),
					})}
				</Text>
			) : undefined;
		const group = typeof chosen === "string" ? (field.fields[chosen] ?? {}) : {};
		// In the order the conditional field keeps for the option (the fields list's dragging), then the rest as the schema has them.
		const inOrder = inOptionOrder(
			Object.keys(group),
			typeof chosen === "string" ? values[key]?.optionFields?.[chosen] : undefined,
		);
		return [row(key, lost), ...inOrder.flatMap((each) => rowsOf(each, group[each]))];
	};
	const rows = (key: string) => rowsOf(key, top[key]);

	/** The fields a tab can show: its own, and under a conditional field the fields of its options. */
	const tabFields = (each: Layout[number]) =>
		each.fields
			.flatMap((entry) => (typeof entry === "string" ? [entry] : entry.fields))
			.flatMap((key) => {
				const field = top[key];
				return field?.kind === "conditional" ? [key, ...Object.values(field.fields).flatMap(allUnder)] : [key];
			});

	if (!picked) return null;
	return (
		<PropertyPanel
			label={t("entry.properties")}
			value={String(layout.indexOf(picked))}
			onValueChange={(next) => onTab(Number(next))}
			tabs={layout.map((each, index) => ({
				value: String(index),
				label: each.tab,
				// A proposal waiting in a tab that is not the open one: a blue dot by its name (screens/editor.md).
				...(each !== picked &&
				!readOnly &&
				tabFields(each).some((field) => editor.draft.cell(fieldPath(field)).kind === "proposed")
					? { dot: "proposal" as const, dotLabel: t("entry.proposal.tab") }
					: {}),
			}))}
		>
			{runs(picked.fields).map((run) => (
				<PropertyGroup key={run.key} title={run.title}>
					{run.fields.flatMap(rows)}
				</PropertyGroup>
			))}
		</PropertyPanel>
	);
}
