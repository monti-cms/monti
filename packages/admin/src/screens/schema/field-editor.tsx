"use client";

import { Add, ChevronDown, ChevronRight, Close } from "@carbon/icons-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fieldTraits, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	Caret,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	FormFieldLegend,
	FormFieldSet,
	Grid,
	IconButton,
	Inline,
	Input,
	OptionRow,
	OptionRowHandle,
	OptionTable,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { type ReactNode, useState } from "react";
import { useAdminComponents } from "../../admin-components";
import { AddFieldSheet } from "./add-field";
import {
	countOrUndefined,
	FlagSwitch,
	IssueList,
	NameInput,
	orUndefined,
	Pick,
	RowActions,
	TextInput,
	useIssuesUnder,
	useSchemaEdit,
} from "./controls";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input";
import { schemaFieldsMessages } from "./fields.messages";
import { SortableList } from "./fields-tree-dnd";
import { schemaMessages } from "./messages";
import {
	ADDABLE_KINDS,
	addOption,
	allFieldNames,
	collectionLabel,
	FIELD_KEY_ORDER,
	type FieldKindName,
	type FieldPlace,
	fieldsOf,
	hasBody,
	isObj,
	moveField,
	moveOption,
	type Obj,
	optionsOf,
	type Rename,
	removeBlock,
	removeField,
	removeOption,
	renameField,
	renameOption,
	setDefaultOption,
	setField,
	setOptionLabel,
	setProp,
	setTitleField,
	titleFieldName,
	type UnpublishedTargets,
	unpublishedTargetsOf,
	withKind,
	withOptionFields,
	withUnpublishedTargets,
} from "./schema-model";

export interface CollectionEditing {
	readonly collectionName: string;
	readonly collection: Obj;
	/** Changes the collection (the screen puts the result into the file). */
	readonly update: (change: (collection: Obj) => Obj) => void;
	/** A field or option was renamed: the review offers it as a rename. */
	readonly onRename: (rename: Rename) => void;
	/** Changes the whole file, for an edit that reaches another collection (the other side of a relation). */
	readonly updateFile?: (change: (file: Obj) => Obj) => void;
}

/** The kinds a field can be switched to in its editor: the ones offered for a new field, and the kind it has now. */
export const kindChoices = (kind: FieldKindName): readonly FieldKindName[] =>
	(ADDABLE_KINDS as readonly FieldKindName[]).includes(kind) ? ADDABLE_KINDS : [...ADDABLE_KINDS, kind];

/** Whether a many relation is also shown on its target, and the switch that changes it. Absent where the other side cannot be edited. */
export interface OppositeSwitch {
	readonly on: boolean;
	readonly onChange: (on: boolean) => void;
}

/** Which of the settings of a kind are drawn: `basic` is the add sheet's first tab (and the inline editor), `advanced` the rest of what it offers; the field sheet splits the same settings into what is seen (`view`) and what is structure. */
export type KindPart = "basic" | "advanced" | "view" | "structure";

/** The settings of a relation: what it points to and how many, whether a new one can be made from the list, and what an unpublished target does. */
function RelationOptions({
	part,
	field,
	set,
	change,
	opposite,
}: {
	part: KindPart;
	field: Obj;
	set: (key: string, value: unknown) => void;
	change: (update: (field: Obj) => Obj) => void;
	opposite?: OppositeSwitch;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { collectionNames, file } = useSchemaEdit();
	const target = typeof field.to === "string" ? field.to : "";
	const many = field.many === true;
	const to = (
		<Pick
			key="to"
			label={t("field.relationTo")}
			value={target}
			items={collectionNames.map((name) => ({ value: name, label: collectionLabel(file, name) }))}
			onChange={(next) => set("to", next)}
		/>
	);
	const pickMany = (
		<FlagSwitch
			key="many"
			label={t("field.many")}
			checked={many}
			onChange={(on) => set("many", on ? true : undefined)}
		/>
	);
	const createInline = (
		<FlagSwitch
			key="createInline"
			label={t("field.createInline")}
			checked={field.createInline === true}
			onChange={(on) => set("createInline", on ? true : undefined)}
		/>
	);
	const unpublished = (
		<Pick
			key="unpublished"
			label={t("field.unpublished", { target: collectionLabel(file, target) })}
			value={unpublishedTargetsOf(field)}
			items={(["hidden", "blocking", "allowed"] as const).map((choice) => ({
				value: choice,
				label: t(`field.unpublished.${choice}`),
			}))}
			onChange={(choice) => change((current) => withUnpublishedTargets(current, choice as UnpublishedTargets))}
		/>
	);
	const placeholder = (
		<TextInput
			key="placeholder"
			label={t("field.placeholder")}
			value={field.placeholder as string | undefined}
			onChange={(text) => set("placeholder", orUndefined(text))}
		/>
	);
	const showOpposite = many && opposite && (
		<FlagSwitch key="opposite" label={t("field.opposite")} checked={opposite.on} onChange={opposite.onChange} />
	);
	const shown = {
		basic: [to, pickMany, createInline, unpublished],
		advanced: [placeholder, showOpposite],
		view: [placeholder],
		structure: [to, pickMany, createInline, unpublished, showOpposite],
	}[part].filter(Boolean);
	return shown.length === 0 ? null : <Stack gap={16}>{shown}</Stack>;
}

/** One choice of a select as a row of the table: dragged by its handle, value and label as text until pressed, and a × that takes it out. */
function OptionEditorRow({
	value,
	label,
	fieldName,
	taken,
	canDrag,
	editing,
	change,
}: {
	value: string;
	label: string | undefined;
	fieldName: string;
	taken: readonly string[];
	canDrag: boolean;
	editing: CollectionEditing;
	change: (update: (field: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const ts = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: value,
		disabled: !canDrag,
	});
	return (
		<OptionRow
			ref={setNodeRef}
			drag={{ transform: CSS.Translate.toString(transform), transition, active: isDragging }}
			handle={
				canDrag ? (
					<OptionRowHandle
						ref={setActivatorNodeRef}
						{...attributes}
						{...listeners}
						aria-label={t("options.drag", { name: value })}
					/>
				) : undefined
			}
			value={
				<NameInput
					bare
					label={t("options.value")}
					value={value}
					taken={taken}
					onCommit={(to) => {
						change((current) => renameOption(current, value, to));
						editing.onRename({
							kind: "option",
							collection: editing.collectionName,
							field: fieldName,
							from: value,
							to,
						});
					}}
				/>
			}
			label={
				<Input
					appearance="inline"
					aria-label={`${t("options.label")}: ${value}`}
					value={label ?? ""}
					disabled={disabled}
					onChange={(event) => change((current) => setOptionLabel(current, value, event.target.value))}
				/>
			}
			action={
				<IconButton
					label={ts("row.remove", { name: value })}
					disabled={disabled}
					onClick={() => change((current) => removeOption(current, value))}
				>
					<Close aria-hidden />
				</IconButton>
			}
		/>
	);
}

/** The options of a select (or of the select a conditional field shows): a table of value and label, an add button under it, and the default in a menu. */
function OptionsEditor({
	field,
	fieldName,
	editing,
	change,
}: {
	field: Obj;
	fieldName: string;
	editing: CollectionEditing;
	change: (update: (field: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { disabled } = useSchemaEdit();
	const options = optionsOf(field);
	const values = Object.keys(options);
	const select = field.kind === "conditional" && isObj(field.discriminant) ? field.discriminant : field;
	const defaultValue = typeof select.defaultValue === "string" ? select.defaultValue : undefined;
	const addOne = () => {
		let n = values.length + 1;
		while (`option${n}` in options) n += 1;
		change((current) => addOption(current, `option${n}`, t("options.newLabel", { n })));
	};
	return (
		<FormFieldSet>
			<FormFieldLegend variant="field">{t("options.title")}</FormFieldLegend>
			<OptionTable valueLabel={t("options.value")} labelLabel={t("options.label")}>
				<SortableList
					items={values}
					onDragEnd={(from, to) => {
						const delta = values.indexOf(to) - values.indexOf(from);
						if (delta !== 0) change((current) => moveOption(current, from, delta));
					}}
				>
					{values.map((value) => (
						<OptionEditorRow
							key={value}
							value={value}
							label={options[value]}
							fieldName={fieldName}
							taken={values.filter((item) => item !== value)}
							canDrag={!disabled && values.length > 1}
							editing={editing}
							change={change}
						/>
					))}
				</SortableList>
			</OptionTable>
			{!disabled && (
				<Inline gap={16} paddingTop={8}>
					<TextButton onClick={addOne}>{t("options.add")}</TextButton>
					<Box as="span" grow />
					{defaultValue !== undefined && defaultValue in options && (
						<DropdownMenu>
							<DropdownMenuTrigger render={<TextButton quiet />}>
								{t("options.defaultIs", { label: options[defaultValue] || defaultValue })}
								<Caret />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuRadioGroup
									value={defaultValue}
									onValueChange={(next) => change((current) => setDefaultOption(current, String(next)))}
								>
									{values.map((value) => (
										<DropdownMenuRadioItem key={value} value={value}>
											{options[value] || value}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</Inline>
			)}
		</FormFieldSet>
	);
}

/** What the kind of the field adds: its own settings. `part` says which of them are drawn (see {@link KindPart}). */
export function KindOptions({
	name,
	field,
	editing,
	set,
	change,
	place = {},
	opposite,
	part = "basic",
}: {
	name: string;
	field: Obj;
	editing: CollectionEditing;
	set: (key: string, value: unknown) => void;
	change: (update: (field: Obj) => Obj) => void;
	/** Where the field is: per-option fields exist only at the top level. */
	place?: FieldPlace;
	/** The switch that shows a many relation on its target too. */
	opposite?: OppositeSwitch;
	part?: KindPart;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { collectionNames, file } = useSchemaEdit();
	const optionFields = !place.branch && (
		<FlagSwitch
			key="optionFields"
			label={t("field.optionFields")}
			checked={field.kind === "conditional"}
			onChange={(on) => change((current) => withOptionFields(current, on))}
		/>
	);
	const placeholder = (
		<TextInput
			key="placeholder"
			label={t("field.placeholder")}
			value={field.placeholder as string | undefined}
			onChange={(value) => set("placeholder", orUndefined(value))}
		/>
	);
	const collections = collectionNames.map((value) => ({ value, label: value }));
	/** The settings the part draws, one under another. */
	const column = (lists: Record<KindPart, ReactNode[]>) => {
		const shown = lists[part].filter(Boolean);
		return shown.length === 0 ? null : <Stack gap={16}>{shown}</Stack>;
	};
	switch (field.kind) {
		case "text": {
			const fill = field.fillFromBody;
			const multiline = (
				<FlagSwitch
					key="multiline"
					label={t("field.multiline")}
					checked={field.multiline === true}
					onChange={(on) => set("multiline", on ? true : undefined)}
				/>
			);
			const max = (
				<TextInput
					key="max"
					label={t("field.max")}
					type="number"
					mono
					value={field.max as number | undefined}
					onChange={(value) => set("max", countOrUndefined(value))}
				/>
			);
			const rows = field.multiline === true && (
				<TextInput
					key="rows"
					label={t("field.rows")}
					type="number"
					mono
					value={field.rows as number | undefined}
					onChange={(value) => set("rows", countOrUndefined(value))}
				/>
			);
			const fillSwitch = hasBody(editing.collection) && (
				<FlagSwitch
					key="fill"
					label={t("field.fillFromBody")}
					checked={Boolean(fill)}
					onChange={(on) => set("fillFromBody", on ? true : undefined)}
				/>
			);
			const fillLength = hasBody(editing.collection) && Boolean(fill) && (
				<TextInput
					key="fillLength"
					label={t("field.fillLength")}
					type="number"
					mono
					value={isObj(fill) ? (fill.maxLength as number | undefined) : undefined}
					placeholder="160"
					onChange={(value) => {
						const maxLength = countOrUndefined(value);
						set("fillFromBody", maxLength === undefined ? true : { maxLength });
					}}
				/>
			);
			return column({
				basic: [
					multiline,
					<Grid key="sizes" columns={2} gap={20}>
						{max}
						{rows}
					</Grid>,
					placeholder,
					fillSwitch,
					fillLength,
				],
				advanced: [],
				view: [placeholder, rows],
				structure: [multiline, max, fillSwitch, fillLength],
			});
		}
		case "slug": {
			const texts = Object.entries(fieldsOf(editing.collection))
				.filter(([, item]) => item.kind === "text")
				.map(([key]) => ({ value: key, label: key }));
			const from = (
				<Pick
					key="from"
					label={t("field.slugFrom")}
					value={typeof field.from === "string" ? field.from : ""}
					items={[{ value: "", label: t("none") }, ...texts]}
					onChange={(value) => set("from", orUndefined(value))}
				/>
			);
			return column({ basic: [from, placeholder], advanced: [], view: [placeholder], structure: [from] });
		}
		case "relation":
			return <RelationOptions part={part} field={field} set={set} change={change} opposite={opposite} />;
		case "select": {
			const options = <OptionsEditor key="options" field={field} fieldName={name} editing={editing} change={change} />;
			return column({ basic: [options, optionFields], advanced: [], view: [], structure: [options, optionFields] });
		}
		case "media": {
			const accept = (
				<Pick
					key="accept"
					label={t("field.accept")}
					value={(field.accept as string | undefined) ?? "image"}
					items={[
						{ value: "image", label: t("field.acceptImage") },
						{ value: "file", label: t("field.acceptFile") },
					]}
					onChange={(value) => set("accept", value === "image" ? undefined : value)}
				/>
			);
			return column({ basic: [accept, placeholder], advanced: [], view: [placeholder], structure: [accept] });
		}
		case "backlink": {
			const from = typeof field.from === "string" ? field.from : "";
			const target = isObj(file.collections) ? (file.collections as Record<string, Obj>)[from] : undefined;
			const relations = Object.entries(target ? fieldsOf(target) : {})
				.filter(([, item]) => item.kind === "relation" && item.many === true)
				.map(([key]) => ({ value: key, label: key }));
			const source = (
				<Pick
					key="from"
					label={t("field.backlinkFrom")}
					value={from}
					items={collections}
					onChange={(value) => set("from", value)}
				/>
			);
			const via = (
				<Pick
					key="via"
					label={t("field.backlinkVia")}
					value={typeof field.via === "string" ? field.via : ""}
					items={relations}
					onChange={(value) => set("via", value)}
				/>
			);
			const createInline = (
				<FlagSwitch
					key="createInline"
					label={t("field.createInline")}
					checked={field.createInline === true}
					onChange={(on) => set("createInline", on ? true : undefined)}
				/>
			);
			return column({
				basic: [source, via, createInline, placeholder],
				advanced: [],
				view: [placeholder],
				structure: [source, via, createInline],
			});
		}
		case "view": {
			const view = (
				<TextInput
					key="view"
					label={t("field.view")}
					value={field.view as string | undefined}
					onChange={(value) => set("view", value)}
				/>
			);
			return column({ basic: [view], advanced: [], view: [], structure: [view] });
		}
		case "conditional": {
			const options = optionsOf(field);
			const values = isObj(field.values) ? (field.values as Record<string, Record<string, Obj>>) : {};
			const editor = <OptionsEditor key="options" field={field} fieldName={name} editing={editing} change={change} />;
			const branches = (
				<Stack key="branches" gap={8}>
					{Object.keys(options).map((option) => (
						<Stack key={option} gap={8} border="dashed" radius="md" padding={8}>
							<Text variant="caption" weight="medium">
								{t("field.whenOption", { option: options[option] ?? option })}
							</Text>
							<FieldList editing={editing} place={{ branch: { field: name, option } }} fields={values[option] ?? {}} />
						</Stack>
					))}
				</Stack>
			);
			return column({
				basic: [editor, optionFields, branches],
				advanced: [],
				view: [],
				structure: [editor, optionFields, branches],
			});
		}
		default:
			return null;
	}
}

export const LOCALIZED_KINDS: readonly string[] = ["text", "slug", "relation", "select", "media", "conditional"];

export function FieldEditor({
	editing,
	place,
	name,
	field,
	index,
	count,
}: {
	editing: CollectionEditing;
	place: FieldPlace;
	name: string;
	field: Obj;
	index: number;
	count: number;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { disabled, collectionNames } = useSchemaEdit();
	const [open, setOpen] = useState(false);
	const path = place.branch
		? `collections.${editing.collectionName}.fields.${place.branch.field}.values.${place.branch.option}.${name}`
		: `collections.${editing.collectionName}.fields.${name}`;
	const issues = useIssuesUnder(path);
	const kind = String(field.kind) as FieldKindName;

	const change = (update: (field: Obj) => Obj) =>
		editing.update((collection) => setField(collection, place, name, update));
	const set = (key: string, value: unknown) => change((current) => setProp(current, key, value, FIELD_KEY_ORDER));
	const setBoth = (key: "label" | "description", value: string | undefined) =>
		change((current) => {
			const next = setProp(current, key, value, FIELD_KEY_ORDER);
			// A conditional field names its select the same way.
			return current.kind === "conditional" && isObj(next.discriminant)
				? { ...next, discriminant: setProp(next.discriminant, key, value, FIELD_KEY_ORDER) }
				: next;
		});
	const valueKind = fieldTraits[kind].entersValue;
	const label = typeof field.label === "string" ? field.label : "";
	// The title field is a top-level text field: the one with the title role, or the one named `title`.
	const isTitle = !place.branch && titleFieldName(editing.collection) === name;
	const isSlug = !place.branch && (kind === "slug" || name === "slug");
	const isFixed = isTitle || isSlug;
	const { fieldInputs } = useAdminComponents();
	const hasPluginInputs = Object.keys(fieldInputs ?? {}).length > 0;
	const hasCustomInput = typeof field.input === "string" && field.input.length > 0;
	const blocked = removeBlock(editing.collection, place, name);

	return (
		<Collapsible open={open} onOpenChange={setOpen} render={<Box border="bottom" />} data-testid={`field-${name}`}>
			<Inline gap={4} paddingX={4}>
				<CollapsibleTrigger
					render={<Button variant="secondary" width="full" aria-label={t("field.toggle", { name })} />}
				>
					<Inline as="span" grow gap={8} minWidth={0}>
						{open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
						<Text as="code" weight="medium">
							{name}
						</Text>
						<Text variant="caption" tone="muted" truncate>
							{label}
						</Text>
						<Text variant="meta" tone="subtle">
							{t(`kind.${kind}`)}
						</Text>
						{isTitle && (
							<Text variant="meta" tone="subtle" data-testid="title-badge">
								{t("field.titleBadge")}
							</Text>
						)}
						{field.required === true && (
							<Text variant="meta" tone="subtle">
								{t("field.requiredBadge")}
							</Text>
						)}
						{issues.length > 0 && (
							<Text variant="meta" tone="danger">
								{t("field.problems", { count: issues.length })}
							</Text>
						)}
					</Inline>
				</CollapsibleTrigger>
				<RowActions
					index={index}
					count={count}
					name={name}
					onMove={(delta) => editing.update((collection) => moveField(collection, place, name, delta))}
					onRemove={() => editing.update((collection) => removeField(collection, place, name))}
					removeBlocked={blocked ? t(`field.removeBlocked.${blocked}`) : undefined}
				/>
			</Inline>
			<CollapsibleContent>
				<Stack gap={12} border="top" padding={12}>
					<IssueList issues={issues} />
					<Grid columns={2} gap={12}>
						<NameInput
							label={t("field.name")}
							value={name}
							taken={allFieldNames(editing.collection).filter((item) => item !== name)}
							onCommit={(to) => {
								editing.update((collection) => renameField(collection, place, name, to));
								editing.onRename({ kind: "field", collection: editing.collectionName, from: name, to });
							}}
						/>
						<Pick
							label={t("field.kind")}
							value={kind}
							disabled={isFixed}
							items={kindChoices(kind).map((item) => ({ value: item, label: t(`kind.${item}`) }))}
							onChange={(next) => change((current) => withKind(current, next as FieldKindName, collectionNames))}
						/>
						<TextInput label={t("field.label")} value={label} onChange={(value) => setBoth("label", value)} />
						<TextInput
							label={t("field.description")}
							value={field.description as string | undefined}
							onChange={(value) => setBoth("description", orUndefined(value))}
						/>
					</Grid>
					{valueKind && (
						<Grid columns={2} gap={12}>
							{kind === "text" && !place.branch && (
								<FlagSwitch
									label={t("field.isTitle")}
									checked={isTitle}
									locked={isTitle}
									onChange={(on) => on && editing.update((collection) => setTitleField(collection, name))}
								/>
							)}
							{kind !== "conditional" && (
								<FlagSwitch
									label={t("field.required")}
									checked={isTitle || field.required === true}
									locked={isTitle}
									onChange={(on) => set("required", on ? true : undefined)}
								/>
							)}
							{LOCALIZED_KINDS.includes(kind) && (
								<Pick
									label={t("field.localized")}
									value={field.localized === true ? "localized" : field.localized === "inherit" ? "inherit" : "shared"}
									items={[
										{ value: "shared", label: t("field.localizedShared") },
										{ value: "localized", label: t("field.localizedOwn") },
										{ value: "inherit", label: t("field.localizedInherit") },
									]}
									onChange={(value) =>
										set("localized", value === "localized" ? true : value === "inherit" ? "inherit" : undefined)
									}
								/>
							)}
						</Grid>
					)}
					<KindOptions name={name} field={field} editing={editing} set={set} change={change} place={place} />
					<Collapsible render={<Box border="dashed" radius="md" paddingX={12} paddingY={8} />}>
						<CollapsibleTrigger render={<TextButton variant="quiet" render={<button type="button" />} />}>
							{t("field.advanced")}
						</CollapsibleTrigger>
						<CollapsibleContent>
							<Stack gap={16} paddingTop={12}>
								{!isSlug && valueKind && (
									<FieldRolePicker
										role={field.role as string | undefined}
										kind={kind}
										isTitle={isTitle}
										onChange={(role) => set("role", role)}
									/>
								)}
								{!isFixed && valueKind && (hasPluginInputs || hasCustomInput) && (
									<FieldCustomInputPicker
										value={field.input as string | undefined}
										options={field.inputOptions}
										onChangeInput={(input) => set("input", input)}
										onChangeOptions={(opts) => set("inputOptions", opts)}
									/>
								)}
							</Stack>
						</CollapsibleContent>
					</Collapsible>
					{disabled && null}
				</Stack>
			</CollapsibleContent>
		</Collapsible>
	);
}

/** The fields of one branch of a conditional field, each editable, with a button that adds one. */
export function FieldList({
	editing,
	place,
	fields,
}: {
	editing: CollectionEditing;
	place: FieldPlace;
	fields: Record<string, Obj>;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { disabled } = useSchemaEdit();
	const names = Object.keys(fields);
	const [adding, setAdding] = useState(false);
	return (
		<Stack gap={8}>
			{names.length === 0 && (
				<Text as="p" variant="caption" tone="muted">
					{t("field.none")}
				</Text>
			)}
			{names.map((fieldName, index) => (
				<FieldEditor
					key={fieldName}
					editing={editing}
					place={place}
					name={fieldName}
					field={fields[fieldName] ?? {}}
					index={index}
					count={names.length}
				/>
			))}
			{!disabled && (
				<Box width="fit">
					<Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
						<Add aria-hidden />
						{t("field.add")}
					</Button>
				</Box>
			)}
			{adding && (
				<AddFieldSheet
					editing={editing}
					place={place}
					onClose={() => setAdding(false)}
					onAdded={() => setAdding(false)}
				/>
			)}
		</Stack>
	);
}
