"use client";

import { fieldTraits, OPTION_VALUE_PATTERN, useTranslator } from "@monti-cms/core/site";
import {
	Badge,
	Box,
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Grid,
	Inline,
	Input,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useAdminComponents } from "../../admin-components";
import { RelationCombobox, type RelationOption } from "../entries/relation-combobox";
import { Labeled } from "../shared/labeled";
import { AddFieldDialog } from "./add-field";
import {
	countOrUndefined,
	FlagSwitch,
	IssueList,
	NameInput,
	orUndefined,
	Pick,
	RowActions,
	SegmentedField,
	TextInput,
	useIssuesUnder,
	useSchemaEdit,
} from "./controls";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input";

import { schemaFieldsMessages } from "./fields.messages";
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

/** A few names that stand for the target's entries in the preview of a relation input. */
const previewOptions = (label: string): RelationOption[] =>
	[1, 2, 3].map((number) => ({ value: `preview-${number}`, label: `${label} ${number}` }));

/**
 * The settings of a relation: what it links to and how many, the input as the entry editor will draw it, and the rest under "More". The preview is the real input
 * with stand-in entries, so a setting shows what it does instead of being described.
 */
function RelationOptions({
	field,
	set,
	change,
	opposite,
	more,
}: {
	field: Obj;
	set: (key: string, value: unknown) => void;
	change: (update: (field: Obj) => Obj) => void;
	opposite?: OppositeSwitch;
	more?: ReactNode;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { collectionNames, file } = useSchemaEdit();
	const target = typeof field.to === "string" ? field.to : "";
	const many = field.many === true;
	// Entries made with "Add" in the preview, on top of the stand-ins; they go when the target changes.
	const [created, setCreated] = useState<RelationOption[]>([]);
	const [value, setValue] = useState<string[]>([]);
	const [moreOpen, setMoreOpen] = useState(false);
	const options = [...previewOptions(collectionLabel(file, target)), ...created];
	return (
		<Stack gap={16}>
			<Pick
				label={t("field.relationTo")}
				value={target}
				items={collectionNames.map((name) => ({ value: name, label: collectionLabel(file, name) }))}
				onChange={(next) => {
					set("to", next);
					setCreated([]);
					setValue([]);
				}}
			/>
			<SegmentedField
				label={t("field.count")}
				value={many ? "many" : "one"}
				items={[
					{ value: "one", label: t("field.one") },
					{ value: "many", label: t("field.many") },
				]}
				onChange={(next) => {
					set("many", next === "many" ? true : undefined);
					setValue((current) => (next === "many" ? current : current.slice(0, 1)));
				}}
			/>
			<Stack gap={8} radius="md" background="tool" padding={12} data-testid="relation-preview">
				<Text variant="caption" tone="muted">
					{t("field.preview")}
				</Text>
				<Text weight="medium">{typeof field.label === "string" ? field.label : ""}</Text>
				<RelationCombobox
					key={`${target}-${many}`}
					aria-label={t("field.preview")}
					options={options}
					multiple={many}
					value={value}
					onValueChange={setValue}
					placeholder={typeof field.placeholder === "string" ? field.placeholder : undefined}
					onCreate={
						field.createInline === true
							? async (label) => {
									const option = { value: `preview-${label}`, label };
									setCreated((current) => [...current, option]);
									return option.value;
								}
							: undefined
					}
				/>
			</Stack>
			<Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
				<Box width="fit">
					<CollapsibleTrigger render={<TextButton variant="quiet" />}>
						{moreOpen ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
						{t("field.more")}
					</CollapsibleTrigger>
				</Box>
				<CollapsibleContent>
					<Stack gap={16} paddingTop={16}>
						<FlagSwitch
							label={t("field.createInline")}
							checked={field.createInline === true}
							onChange={(on) => set("createInline", on ? true : undefined)}
						/>
						{many && opposite && (
							<FlagSwitch label={t("field.opposite")} checked={opposite.on} onChange={opposite.onChange} />
						)}
						<Pick
							label={t("field.unpublished")}
							value={unpublishedTargetsOf(field)}
							items={(["hidden", "blocking", "allowed"] as const).map((choice) => ({
								value: choice,
								label: t(`field.unpublished.${choice}`),
							}))}
							onChange={(choice) => change((current) => withUnpublishedTargets(current, choice as UnpublishedTargets))}
						/>
						<TextInput
							label={t("field.placeholder")}
							value={field.placeholder as string | undefined}
							onChange={(text) => set("placeholder", orUndefined(text))}
						/>
						{more}
					</Stack>
				</CollapsibleContent>
			</Collapsible>
		</Stack>
	);
}

/** The options of a select (or of the select a conditional field shows): value, label, default, order. */
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
	const [draftValue, setDraftValue] = useState("");
	const taken = (value: string) => values.filter((item) => item !== value);
	const addable = draftValue !== "" && OPTION_VALUE_PATTERN.test(draftValue) && !values.includes(draftValue);
	return (
		<Stack role="group" aria-labelledby={`options-${fieldName}`} gap={8}>
			<Text as="div" id={`options-${fieldName}`} variant="caption" weight="medium">
				{t("options.title")}
			</Text>
			<Stack as="ul" gap={8}>
				{values.map((value, index) => (
					<Inline as="li" key={value} wrap align="end" gap={8} border="all" radius="md" background="page" padding={8}>
						<Box grow>
							<NameInput
								label={t("options.value")}
								value={value}
								taken={taken(value)}
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
						</Box>
						<Box grow>
							<TextInput
								label={t("options.label")}
								value={options[value]}
								onChange={(label) => change((current) => setOptionLabel(current, value, label))}
							/>
						</Box>
						<Inline as="label" gap={8} paddingBottom={8}>
							<input
								type="radio"
								name={`default-${fieldName}`}
								checked={select.defaultValue === value}
								disabled={disabled}
								onChange={() => change((current) => setDefaultOption(current, value))}
							/>
							<Text variant="caption">{t("options.default")}</Text>
						</Inline>
						<RowActions
							index={index}
							count={values.length}
							name={value}
							onMove={(delta) => change((current) => moveOption(current, value, delta))}
							onRemove={() => change((current) => removeOption(current, value))}
						/>
					</Inline>
				))}
			</Stack>
			{!disabled && (
				<Inline align="end" gap={8}>
					<Box width="menu">
						<Labeled label={t("options.newValue")}>
							<Input value={draftValue} placeholder="value" onChange={(event) => setDraftValue(event.target.value)} />
						</Labeled>
					</Box>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						disabled={!addable}
						onClick={() => {
							change((current) =>
								addOption(current, draftValue, draftValue.charAt(0).toUpperCase() + draftValue.slice(1)),
							);
							setDraftValue("");
						}}
					>
						{t("options.add")}
					</Button>
				</Inline>
			)}
		</Stack>
	);
}

/** What the kind of the field adds: its own options. */
export function KindOptions({
	name,
	field,
	editing,
	set,
	change,
	place = {},
	opposite,
	more,
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
	/** More settings to put under a relation's "More" (the add dialog's identifier). */
	more?: ReactNode;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { collectionNames, file } = useSchemaEdit();
	const optionFields = !place.branch && (
		<FlagSwitch
			label={t("field.optionFields")}
			checked={field.kind === "conditional"}
			onChange={(on) => change((current) => withOptionFields(current, on))}
		/>
	);
	const placeholder = (
		<TextInput
			label={t("field.placeholder")}
			value={field.placeholder as string | undefined}
			onChange={(value) => set("placeholder", orUndefined(value))}
		/>
	);
	const collections = collectionNames.map((value) => ({ value, label: value }));
	switch (field.kind) {
		case "text": {
			const fill = field.fillFromBody;
			return (
				<Stack gap={16}>
					<FlagSwitch
						label={t("field.multiline")}
						checked={field.multiline === true}
						onChange={(on) => set("multiline", on ? true : undefined)}
					/>
					{field.multiline === true && (
						<TextInput
							label={t("field.rows")}
							type="number"
							value={field.rows as number | undefined}
							onChange={(value) => set("rows", countOrUndefined(value))}
						/>
					)}
					<TextInput
						label={t("field.max")}
						type="number"
						value={field.max as number | undefined}
						onChange={(value) => set("max", countOrUndefined(value))}
					/>
					{hasBody(editing.collection) && (
						<>
							<FlagSwitch
								label={t("field.fillFromBody")}
								description={t("field.fillFromBodyHint")}
								checked={Boolean(fill)}
								onChange={(on) => set("fillFromBody", on ? true : undefined)}
							/>
							{Boolean(fill) && (
								<TextInput
									label={t("field.fillLength")}
									type="number"
									value={isObj(fill) ? (fill.maxLength as number | undefined) : undefined}
									placeholder="160"
									onChange={(value) => {
										const maxLength = countOrUndefined(value);
										set("fillFromBody", maxLength === undefined ? true : { maxLength });
									}}
								/>
							)}
						</>
					)}
					{placeholder}
				</Stack>
			);
		}
		case "slug": {
			const texts = Object.entries(fieldsOf(editing.collection))
				.filter(([, item]) => item.kind === "text")
				.map(([key]) => ({ value: key, label: key }));
			return (
				<Stack gap={16}>
					<Pick
						label={t("field.slugFrom")}
						description={t("field.slugFromHint")}
						value={typeof field.from === "string" ? field.from : ""}
						items={[{ value: "", label: t("none") }, ...texts]}
						onChange={(value) => set("from", orUndefined(value))}
					/>
					{placeholder}
				</Stack>
			);
		}
		case "relation":
			return <RelationOptions field={field} set={set} change={change} opposite={opposite} more={more} />;
		case "select":
			return (
				<Stack gap={16}>
					<OptionsEditor field={field} fieldName={name} editing={editing} change={change} />
					{optionFields}
				</Stack>
			);
		case "media":
			return (
				<Stack gap={16}>
					<Pick
						label={t("field.accept")}
						value={(field.accept as string | undefined) ?? "image"}
						items={[
							{ value: "image", label: t("field.acceptImage") },
							{ value: "file", label: t("field.acceptFile") },
						]}
						onChange={(value) => set("accept", value === "image" ? undefined : value)}
					/>
					{placeholder}
				</Stack>
			);
		case "backlink": {
			const from = typeof field.from === "string" ? field.from : "";
			const target = isObj(file.collections) ? (file.collections as Record<string, Obj>)[from] : undefined;
			const relations = Object.entries(target ? fieldsOf(target) : {})
				.filter(([, item]) => item.kind === "relation" && item.many === true)
				.map(([key]) => ({ value: key, label: key }));
			return (
				<Stack gap={16}>
					<Pick
						label={t("field.backlinkFrom")}
						value={from}
						items={collections}
						onChange={(value) => set("from", value)}
					/>
					<Pick
						label={t("field.backlinkVia")}
						description={t("field.backlinkViaHint")}
						value={typeof field.via === "string" ? field.via : ""}
						items={relations}
						onChange={(value) => set("via", value)}
					/>
					<FlagSwitch
						label={t("field.createInline")}
						checked={field.createInline === true}
						onChange={(on) => set("createInline", on ? true : undefined)}
					/>
					{placeholder}
				</Stack>
			);
		}
		case "view":
			return (
				<TextInput
					label={t("field.view")}
					description={t("field.viewHint")}
					value={field.view as string | undefined}
					onChange={(value) => set("view", value)}
				/>
			);
		case "conditional": {
			const options = optionsOf(field);
			const values = isObj(field.values) ? (field.values as Record<string, Record<string, Obj>>) : {};
			return (
				<Stack gap={12}>
					<OptionsEditor field={field} fieldName={name} editing={editing} change={change} />
					{optionFields}
					<Stack gap={8}>
						{Object.keys(options).map((option) => (
							<Stack key={option} gap={8} border="dashed" radius="md" padding={8}>
								<Text variant="caption" weight="medium">
									{t("field.whenOption", { option: options[option] ?? option })}
								</Text>
								<FieldList
									editing={editing}
									place={{ branch: { field: name, option } }}
									fields={values[option] ?? {}}
								/>
							</Stack>
						))}
					</Stack>
				</Stack>
			);
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
						<Badge variant="secondary">{t(`kind.${kind}`)}</Badge>
						{isTitle && (
							<Badge variant="outline" data-testid="title-badge">
								{t("field.titleBadge")}
							</Badge>
						)}
						{field.required === true && <Badge variant="outline">{t("field.requiredBadge")}</Badge>}
						{issues.length > 0 && <Badge variant="danger">{t("field.problems", { count: issues.length })}</Badge>}
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
							description={t("field.nameHint")}
							onCommit={(to) => {
								editing.update((collection) => renameField(collection, place, name, to));
								editing.onRename({ kind: "field", collection: editing.collectionName, from: name, to });
							}}
						/>
						<Pick
							label={t("field.kind")}
							description={isTitle ? t("field.kindFixedTitleHint") : isSlug ? t("field.kindFixedSlugHint") : undefined}
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
									description={isTitle ? t("field.isTitleFixedHint") : t("field.isTitleHint")}
									checked={isTitle}
									locked={isTitle}
									onChange={(on) => on && editing.update((collection) => setTitleField(collection, name))}
								/>
							)}
							{kind !== "conditional" && (
								<FlagSwitch
									label={t("field.required")}
									description={isTitle ? t("field.requiredTitleHint") : t("field.requiredHint")}
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
						<Plus aria-hidden />
						{t("field.add")}
					</Button>
				</Box>
			)}
			{adding && (
				<AddFieldDialog
					editing={editing}
					place={place}
					onClose={() => setAdding(false)}
					onAdded={() => setAdding(false)}
				/>
			)}
		</Stack>
	);
}
