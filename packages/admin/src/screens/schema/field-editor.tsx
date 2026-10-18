"use client";

import { fieldTraits, OPTION_VALUE_PATTERN, useTranslator } from "@monti-cms/core/site";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAdminComponents } from "../../admin-components";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Labeled } from "../shared/labeled";
import {
	AddButton,
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
import {
	addField,
	addOption,
	allFieldNames,
	FIELD_KEY_ORDER,
	FIELD_KINDS,
	type FieldKindName,
	type FieldPlace,
	fieldAt,
	fieldProblems,
	fieldsOf,
	hasBody,
	isObj,
	KINDS_WITH_SETTINGS,
	moveField,
	moveOption,
	nameProblem,
	newField,
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
	VALUE_KINDS,
	withKind,
} from "./schema-model";

export interface CollectionEditing {
	readonly collectionName: string;
	readonly collection: Obj;
	/** Changes the collection (the screen puts the result into the file). */
	readonly update: (change: (collection: Obj) => Obj) => void;
	/** A field or option was renamed: the review offers it as a rename. */
	readonly onRename: (rename: Rename) => void;
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
		<fieldset className="flex flex-col gap-1.5">
			<legend className="font-medium text-xs">{t("options.title")}</legend>
			<ul className="flex flex-col gap-1.5">
				{values.map((value, index) => (
					<li key={value} className="flex flex-wrap items-end gap-2 rounded-md border bg-monti-background p-2">
						<NameInput
							label={t("options.value")}
							value={value}
							taken={taken(value)}
							className="w-32 flex-none"
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
						<TextInput
							label={t("options.label")}
							value={options[value]}
							className="min-w-32 flex-1"
							onChange={(label) => change((current) => setOptionLabel(current, value, label))}
						/>
						<label className="flex items-center gap-1.5 pb-2 text-xs">
							<input
								type="radio"
								name={`default-${fieldName}`}
								checked={select.defaultValue === value}
								disabled={disabled}
								onChange={() => change((current) => setDefaultOption(current, value))}
							/>
							{t("options.default")}
						</label>
						<RowActions
							index={index}
							count={values.length}
							name={value}
							onMove={(delta) => change((current) => moveOption(current, value, delta))}
							onRemove={() => change((current) => removeOption(current, value))}
						/>
					</li>
				))}
			</ul>
			{!disabled && (
				<div className="flex items-end gap-2">
					<Labeled label={t("options.newValue")} className="w-40">
						<Input value={draftValue} placeholder="value" onChange={(event) => setDraftValue(event.target.value)} />
					</Labeled>
					<Button
						type="button"
						variant="outline"
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
				</div>
			)}
		</fieldset>
	);
}

/** What the kind of the field adds: its own options. */
export function KindOptions({
	name,
	field,
	editing,
	set,
	change,
}: {
	name: string;
	field: Obj;
	editing: CollectionEditing;
	set: (key: string, value: unknown) => void;
	change: (update: (field: Obj) => Obj) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { collectionNames, file } = useSchemaEdit();
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
				<div className="flex flex-col gap-5">
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
				</div>
			);
		}
		case "slug": {
			const texts = Object.entries(fieldsOf(editing.collection))
				.filter(([, item]) => item.kind === "text")
				.map(([key]) => ({ value: key, label: key }));
			return (
				<div className="flex flex-col gap-5">
					<Pick
						label={t("field.slugFrom")}
						description={t("field.slugFromHint")}
						value={typeof field.from === "string" ? field.from : ""}
						items={[{ value: "", label: t("none") }, ...texts]}
						onChange={(value) => set("from", orUndefined(value))}
					/>
					{placeholder}
				</div>
			);
		}
		case "relation":
			return (
				<div className="flex flex-col gap-5">
					<Pick
						label={t("field.relationTo")}
						value={typeof field.to === "string" ? field.to : ""}
						items={collections}
						onChange={(value) => set("to", value)}
					/>
					{placeholder}
					<FlagSwitch
						label={t("field.many")}
						checked={field.many === true}
						onChange={(on) => set("many", on ? true : undefined)}
					/>
					{field.many === true && (
						<FlagSwitch
							label={t("field.ordered")}
							description={t("field.orderedHint")}
							checked={field.ordered === true}
							onChange={(on) => set("ordered", on ? true : undefined)}
						/>
					)}
					<FlagSwitch
						label={t("field.createInline")}
						checked={field.createInline === true}
						onChange={(on) => set("createInline", on ? true : undefined)}
					/>
					<FlagSwitch
						label={t("field.publishedOnly")}
						checked={field.publishedOnly === true}
						onChange={(on) => set("publishedOnly", on ? true : undefined)}
					/>
					<FlagSwitch
						label={t("field.allowUnpublished")}
						checked={field.allowUnpublished === true}
						onChange={(on) => set("allowUnpublished", on ? true : undefined)}
					/>
				</div>
			);
		case "select":
			return <OptionsEditor field={field} fieldName={name} editing={editing} change={change} />;
		case "media":
			return (
				<div className="flex flex-col gap-5">
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
				</div>
			);
		case "backlink": {
			const from = typeof field.from === "string" ? field.from : "";
			const target = isObj(file.collections) ? (file.collections as Record<string, Obj>)[from] : undefined;
			const relations = Object.entries(target ? fieldsOf(target) : {})
				.filter(([, item]) => item.kind === "relation" && item.many === true)
				.map(([key]) => ({ value: key, label: key }));
			return (
				<div className="flex flex-col gap-5">
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
				</div>
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
				<div className="flex flex-col gap-3">
					<OptionsEditor field={field} fieldName={name} editing={editing} change={change} />
					<div className="flex flex-col gap-2">
						{Object.keys(options).map((option) => (
							<div key={option} className="flex flex-col gap-2 rounded-md border border-dashed p-2">
								<span className="font-medium text-xs">
									{t("field.whenOption", { option: options[option] ?? option })}
								</span>
								<FieldList
									editing={editing}
									place={{ branch: { field: name, option } }}
									fields={values[option] ?? {}}
									kinds={VALUE_KINDS}
								/>
							</div>
						))}
					</div>
				</div>
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
	const branchKinds = place.branch ? VALUE_KINDS : FIELD_KINDS;

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
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-lg border bg-monti-card"
			data-testid={`field-${name}`}
		>
			<div className="flex items-center gap-1 pr-1">
				<CollapsibleTrigger
					aria-label={t("field.toggle", { name })}
					className="group/field flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-monti-ring"
				>
					<ChevronRight aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
					<code className="shrink-0 font-medium text-sm">{name}</code>
					<span className="truncate text-monti-muted-foreground text-xs">{label}</span>
					<Badge variant="secondary" className="shrink-0">
						{t(`kind.${kind}`)}
					</Badge>
					{isTitle && (
						<Badge variant="outline" className="shrink-0" data-testid="title-badge">
							{t("field.titleBadge")}
						</Badge>
					)}
					{field.required === true && (
						<Badge variant="outline" className="shrink-0">
							{t("field.requiredBadge")}
						</Badge>
					)}
					{issues.length > 0 && (
						<Badge variant="destructive" className="shrink-0">
							{t("field.problems", { count: issues.length })}
						</Badge>
					)}
				</CollapsibleTrigger>
				<RowActions
					index={index}
					count={count}
					name={name}
					onMove={(delta) => editing.update((collection) => moveField(collection, place, name, delta))}
					onRemove={() => editing.update((collection) => removeField(collection, place, name))}
					removeBlocked={blocked ? t(`field.removeBlocked.${blocked}`) : undefined}
				/>
			</div>
			<CollapsibleContent>
				<div className="flex flex-col gap-3 border-t px-3 py-3">
					<IssueList issues={issues} />
					<div className="grid gap-3 sm:grid-cols-2">
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
							items={branchKinds.map((item) => ({ value: item, label: t(`kind.${item}`) }))}
							onChange={(next) => change((current) => withKind(current, next as FieldKindName, collectionNames))}
						/>
						<TextInput label={t("field.label")} value={label} onChange={(value) => setBoth("label", value)} />
						<TextInput
							label={t("field.description")}
							value={field.description as string | undefined}
							onChange={(value) => setBoth("description", orUndefined(value))}
						/>
					</div>
					{valueKind && (
						<div className="grid gap-3 sm:grid-cols-2">
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
						</div>
					)}
					<KindOptions name={name} field={field} editing={editing} set={set} change={change} />
					<details className="rounded-md border border-dashed px-2.5 py-1.5 text-sm">
						<summary className="cursor-pointer text-monti-muted-foreground text-xs">{t("field.advanced")}</summary>
						<div className="mt-3 flex flex-col gap-4">
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
						</div>
					</details>
					{disabled && null}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * The settings a new field needs, asked before it exists: the field is made in a copy of the collection and joins the real one only when its required
 * settings are complete, so there is never a half-made field in the file.
 */
export function NewFieldDialog({
	editing,
	place,
	name,
	kind,
	onClose,
}: {
	editing: CollectionEditing;
	place: FieldPlace;
	name: string;
	kind: FieldKindName;
	onClose: (added: boolean) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const tc = useTranslator(commonMessages);
	const { collectionNames } = useSchemaEdit();
	const [draft, setDraft] = useState<Obj>(() =>
		addField(
			editing.collection,
			place,
			name,
			newField(kind, name.charAt(0).toUpperCase() + name.slice(1), collectionNames),
		),
	);
	const field = fieldAt(draft, place, name) ?? {};
	const change = (update: (field: Obj) => Obj) => setDraft((current) => setField(current, place, name, update));
	const set = (key: string, value: unknown) => change((current) => setProp(current, key, value, FIELD_KEY_ORDER));
	// Edits inside the dialog (the fields of a branch of a conditional field) go to the copy; renames of a field that is not stored yet need no record.
	const draftEditing: CollectionEditing = {
		collectionName: editing.collectionName,
		collection: draft,
		update: (apply) => setDraft((current) => apply(current)),
		onRename: () => undefined,
	};
	const problems = fieldProblems(field, draft, collectionNames);
	return (
		<Dialog open onOpenChange={(open) => !open && onClose(false)}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" data-testid="new-field-dialog">
				<DialogHeader>
					<DialogTitle>{t("field.newTitle", { kind: t(`kind.${kind}`) })}</DialogTitle>
					<DialogDescription>{t("field.newDescription", { name })}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<TextInput
						label={t("field.label")}
						value={typeof field.label === "string" ? field.label : ""}
						onChange={(value) =>
							change((current) => {
								const next = setProp(current, "label", value, FIELD_KEY_ORDER);
								return current.kind === "conditional" && isObj(next.discriminant)
									? { ...next, discriminant: setProp(next.discriminant, "label", value, FIELD_KEY_ORDER) }
									: next;
							})
						}
					/>
					<KindOptions name={name} field={field} editing={draftEditing} set={set} change={change} />
					{problems.length > 0 && (
						<ul className="flex flex-col gap-0.5 text-monti-muted-foreground text-xs" data-testid="new-field-problems">
							{problems.map((problem) => (
								<li key={problem}>{t(`field.needs.${problem}`)}</li>
							))}
						</ul>
					)}
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onClose(false)}>
						{tc("cancel")}
					</Button>
					<Button
						type="button"
						disabled={problems.length > 0}
						onClick={() => {
							editing.update(() => draft);
							onClose(true);
						}}
					>
						{tc("add")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** The fields of a collection (or of one branch of a conditional field), each editable, with a row to add one. */
export function FieldList({
	editing,
	place,
	fields,
	kinds,
}: {
	editing: CollectionEditing;
	place: FieldPlace;
	fields: Record<string, Obj>;
	kinds: readonly FieldKindName[];
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { collectionNames, disabled } = useSchemaEdit();
	const names = Object.keys(fields);
	const [name, setName] = useState("");
	const [kind, setKind] = useState<FieldKindName>("text");
	const [pending, setPending] = useState<{ name: string; kind: FieldKindName } | null>(null);
	const taken = allFieldNames(editing.collection);
	const problem = nameProblem(name, taken);
	return (
		<div className="flex flex-col gap-2">
			{names.length === 0 && <p className="text-monti-muted-foreground text-xs">{t("field.none")}</p>}
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
				<div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-2">
					<Labeled label={t("field.newName")} className="min-w-36 flex-1">
						<Input
							value={name}
							aria-label={t("field.newName")}
							placeholder="fieldName"
							aria-invalid={name !== "" && problem ? true : undefined}
							onChange={(event) => setName(event.target.value)}
						/>
					</Labeled>
					<Pick
						label={t("field.kind")}
						className="w-40"
						value={kind}
						items={kinds.map((item) => ({ value: item, label: t(`kind.${item}`) }))}
						onChange={(next) => setKind(next as FieldKindName)}
					/>
					<AddButton
						disabled={Boolean(problem)}
						onClick={() => {
							if (problem) return;
							if (KINDS_WITH_SETTINGS.includes(kind)) {
								setPending({ name, kind });
								return;
							}
							editing.update((collection) =>
								addField(
									collection,
									place,
									name,
									newField(kind, name.charAt(0).toUpperCase() + name.slice(1), collectionNames),
								),
							);
							setName("");
						}}
					>
						{t("field.add")}
					</AddButton>
				</div>
			)}
			{pending && (
				<NewFieldDialog
					key={pending.name}
					editing={editing}
					place={place}
					name={pending.name}
					kind={pending.kind}
					onClose={(added) => {
						setPending(null);
						if (added) setName("");
					}}
				/>
			)}
		</div>
	);
}
