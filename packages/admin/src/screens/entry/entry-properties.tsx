import { type FieldDefinition, type FieldMark, localeModeOf, slugify } from "@monti-cms/core";
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
	IconButton,
	Inline,
	Input,
	List,
	OrderedRow,
	PropertyGroup,
	PropertyPanel,
	Sortable,
	SortableList,
	Stack,
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

/** The id of a field's input: a to-do row puts the cursor there. */
export const fieldInputId = (field: string) => `monti-entry-${field}`;

/** The kinds of field the panel holds. */
const SHOWN = new Set<FieldDefinition["kind"]>(["text", "slug", "select", "relation", "media"]);

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
}: {
	id: string;
	items: { value: string; label: string }[];
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
	disabled: boolean;
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
			<ComboboxChips ref={anchor} size="md">
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
}: {
	id: string;
	label: string;
	onRemove: () => void;
	removeLabel: string;
	moveLabel: string;
	disabled?: boolean;
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
			<Text>{label}</Text>
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
			<ComboboxInput id={id} size="md" placeholder={placeholder} showClear={!required && Boolean(value)} />
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
			<ComboboxChips ref={anchor} size="md">
				{value.map((item) => (
					<ComboboxChip key={item}>{rel.labelOf(item)}</ComboboxChip>
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
				<ComboboxInput id={id} size="md" placeholder={placeholder} showClear={false} />
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
	const definitions = schema?.schema.collections[collection]?.fields ?? {};
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

	const row = (key: string) => {
		const def = definitions[key];
		if (!def) return null;
		const id = fieldInputId(key);
		const path = key === "slug" ? "slug" : `values.${key}`;
		const value = editor.value(path);
		const text = typeof value === "string" ? value : "";
		const count =
			def.kind === "text" && def.max !== undefined && focused === key ? (
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
			const shown = pickNames(shared[key], values[key]?.optionLabels);
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
					value={value}
					// A translation's empty field follows the source's (doc 09): what shows is that file, until it has its own.
					source={localeModeOf(key, def) === "fromSource" ? shared?.[key] : undefined}
					whose={
						shared && localeModeOf(key, def) === "fromSource"
							? {
									following: t("translation.followsSource"),
									clear: t("translation.backToSource", { label: values[key]?.label ?? key }),
								}
							: undefined
					}
					readOnly={readOnly}
					onChange={(next) => editor.set(path, next)}
				/>
			);
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
						onChange={(event) => editor.set(path, event.target.value)}
						{...focus}
					/>
				);
			if (def.kind === "select") {
				const labels = values[key]?.optionLabels ?? {};
				const items = def.options.map((option) => ({ value: option, label: labels[option] ?? option }));
				return def.many ? (
					<PickMany
						id={id}
						items={items}
						value={Array.isArray(value) ? (value as string[]) : []}
						onChange={(next) => editor.set(path, next)}
						placeholder={empty}
						disabled={readOnly}
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
					action={
						change && count ? (
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
			</FormField>
		);
	};

	if (!picked) return null;
	return (
		<PropertyPanel
			label={t("entry.properties")}
			value={String(layout.indexOf(picked))}
			onValueChange={(next) => onTab(Number(next))}
			tabs={layout.map((each, index) => ({ value: String(index), label: each.tab }))}
		>
			{runs(picked.fields).map((run) => (
				<PropertyGroup key={run.key} title={run.title}>
					{run.fields.map(row)}
				</PropertyGroup>
			))}
		</PropertyPanel>
	);
}
