"use client";

import { useTranslator } from "@monti-cms/core/client";
import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import {
	AddButton,
	countOrUndefined,
	FlagSwitch,
	IssueList,
	Labeled,
	NameInput,
	orUndefined,
	Pick,
	RowActions,
	TextInput,
	useIssuesUnder,
	useSchemaEdit,
} from "./controls";
import { schemaMessages } from "./messages";
import {
	addField,
	addOption,
	allFieldNames,
	FIELD_KEY_ORDER,
	FIELD_KINDS,
	type FieldKindName,
	type FieldPlace,
	fieldsOf,
	isObj,
	moveField,
	moveOption,
	newField,
	type Obj,
	optionsOf,
	type Rename,
	removeField,
	removeOption,
	renameField,
	renameOption,
	setDefaultOption,
	setField,
	setOptionLabel,
	setProp,
	VALUE_KINDS,
	withKind,
} from "./schema-model";

interface CollectionEditing {
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
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const options = optionsOf(field);
	const values = Object.keys(options);
	const select = field.kind === "conditional" && isObj(field.discriminant) ? field.discriminant : field;
	const [draftValue, setDraftValue] = useState("");
	const taken = (value: string) => values.filter((item) => item !== value);
	const addable = draftValue !== "" && /^[A-Za-z0-9_-]+$/.test(draftValue) && !values.includes(draftValue);
	return (
		<fieldset className="flex flex-col gap-1.5">
			<legend className="font-medium text-xs">{t("options.title")}</legend>
			<ul className="flex flex-col gap-1.5">
				{values.map((value, index) => (
					<li key={value} className="flex flex-wrap items-end gap-2 rounded-md border bg-cms-background p-2">
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

/** `inputOptions`: a JSON object of text, number and flag values, checked when the writer leaves the box. */
function InputOptionsEditor({ value, onChange }: { value: unknown; onChange: (value: Obj | undefined) => void }) {
	const t = useTranslator(schemaMessages);
	const id = useId();
	const { disabled } = useSchemaEdit();
	const [text, setText] = useState(isObj(value) ? JSON.stringify(value) : "");
	const [bad, setBad] = useState(false);
	const commit = () => {
		if (text.trim() === "") {
			setBad(false);
			onChange(undefined);
			return;
		}
		try {
			const parsed: unknown = JSON.parse(text);
			const ok =
				isObj(parsed) && Object.values(parsed).every((item) => ["string", "number", "boolean"].includes(typeof item));
			setBad(!ok);
			if (ok) onChange(parsed as Obj);
		} catch {
			setBad(true);
		}
	};
	return (
		<Labeled label={t("field.inputOptions")} htmlFor={id} hint={t("field.inputOptionsHint")}>
			<Textarea
				id={id}
				rows={2}
				value={text}
				disabled={disabled}
				aria-invalid={bad || undefined}
				className="font-mono text-xs"
				onChange={(event) => setText(event.target.value)}
				onBlur={commit}
			/>
			{bad && <p className="text-cms-destructive text-xs">{t("field.inputOptionsBad")}</p>}
		</Labeled>
	);
}

/** What the kind of the field adds: its own options. */
function KindOptions({
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
	const t = useTranslator(schemaMessages);
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
				<div className="grid gap-3 sm:grid-cols-2">
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
					<FlagSwitch
						label={t("field.fillFromBody")}
						hint={t("field.fillFromBodyHint")}
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
					{placeholder}
				</div>
			);
		}
		case "slug": {
			const texts = Object.entries(fieldsOf(editing.collection))
				.filter(([, item]) => item.kind === "text")
				.map(([key]) => ({ value: key, label: key }));
			return (
				<div className="grid gap-3 sm:grid-cols-2">
					<Pick
						label={t("field.slugFrom")}
						hint={t("field.slugFromHint")}
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
				<div className="grid gap-3 sm:grid-cols-2">
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
							hint={t("field.orderedHint")}
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
				<div className="grid gap-3 sm:grid-cols-2">
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
				<div className="grid gap-3 sm:grid-cols-2">
					<Pick
						label={t("field.backlinkFrom")}
						value={from}
						items={collections}
						onChange={(value) => set("from", value)}
					/>
					<Pick
						label={t("field.backlinkVia")}
						hint={t("field.backlinkViaHint")}
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
					hint={t("field.viewHint")}
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

const LOCALIZED_KINDS: readonly string[] = ["text", "slug", "relation", "select", "media", "conditional"];

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
	const t = useTranslator(schemaMessages);
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
	const valueKind = kind !== "view" && kind !== "backlink";
	const label = typeof field.label === "string" ? field.label : "";

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-lg border bg-cms-card"
			data-testid={`field-${name}`}
		>
			<div className="flex items-center gap-1 pr-1">
				<CollapsibleTrigger
					aria-label={t("field.toggle", { name })}
					className="group/field flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-cms-ring"
				>
					<ChevronRight aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
					<code className="shrink-0 font-medium text-sm">{name}</code>
					<span className="truncate text-cms-muted-foreground text-xs">{label}</span>
					<Badge variant="secondary" className="shrink-0">
						{t(`kind.${kind}`)}
					</Badge>
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
							hint={t("field.nameHint")}
							onCommit={(to) => {
								editing.update((collection) => renameField(collection, place, name, to));
								editing.onRename({ kind: "field", collection: editing.collectionName, from: name, to });
							}}
						/>
						<Pick
							label={t("field.kind")}
							value={kind}
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
							{kind !== "conditional" && (
								<FlagSwitch
									label={t("field.required")}
									hint={t("field.requiredHint")}
									checked={field.required === true}
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
						<summary className="cursor-pointer text-cms-muted-foreground text-xs">{t("field.advanced")}</summary>
						<div className="mt-2 grid gap-3 sm:grid-cols-2">
							<FlagSwitch
								label={t("field.hidden")}
								hint={t("field.hiddenHint")}
								checked={field.hidden === true}
								onChange={(on) => set("hidden", on ? true : undefined)}
							/>
							{valueKind && (
								<TextInput
									label={t("field.role")}
									hint={t("field.roleHint")}
									value={field.role as string | undefined}
									onChange={(value) => set("role", orUndefined(value))}
								/>
							)}
							<TextInput
								label={t("field.tab")}
								hint={t("field.tabHint")}
								value={field.tab as string | undefined}
								onChange={(value) => set("tab", orUndefined(value))}
							/>
							{valueKind && (
								<TextInput
									label={t("field.input")}
									hint={t("field.inputHint")}
									value={field.input as string | undefined}
									onChange={(value) => set("input", orUndefined(value))}
								/>
							)}
						</div>
						{valueKind && (
							<div className="mt-3">
								<InputOptionsEditor value={field.inputOptions} onChange={(value) => set("inputOptions", value)} />
							</div>
						)}
					</details>
					{disabled && null}
				</div>
			</CollapsibleContent>
		</Collapsible>
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
	const t = useTranslator(schemaMessages);
	const { collectionNames, disabled } = useSchemaEdit();
	const names = Object.keys(fields);
	const [name, setName] = useState("");
	const [kind, setKind] = useState<FieldKindName>("text");
	const taken = allFieldNames(editing.collection);
	const problem =
		name === "" ? "empty" : taken.includes(name) ? "taken" : /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ? null : "pattern";
	return (
		<div className="flex flex-col gap-2">
			{names.length === 0 && <p className="text-cms-muted-foreground text-xs">{t("field.none")}</p>}
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
		</div>
	);
}
