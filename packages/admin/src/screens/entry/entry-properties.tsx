import { type FieldDefinition, localeModeOf, slugify } from "@monti-cms/core";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	FormField,
	FormFieldDescription,
	FormFieldLabel,
	IconButton,
	Input,
	PropertyGroup,
	PropertyPanel,
	Text,
	Textarea,
	useComboboxAnchor,
} from "@monti-cms/ui";
import { Renew } from "@monti-cms/ui/icons";
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { PickOne } from "../settings/pick-one";
import { type Layout, type SchemaRead, shownLayout } from "../settings/schema-draft";
import type { EntryEditorModel } from "./use-entry-editor";

/** The id of a field's input: a to-do row puts the cursor there. */
export const fieldInputId = (field: string) => `monti-entry-${field}`;

/**
 * The kinds of field the panel holds now. A relation is written by doc 08's operations and a media field picks from doc 09's library: until then they
 * are not in the panel (tracker T66, T67).
 */
const SHOWN = new Set<FieldDefinition["kind"]>(["text", "slug", "select"]);

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
}: {
	editor: EntryEditorModel;
	schema: SchemaRead | null;
	collection: string;
	tab: number;
	onTab: (tab: number) => void;
	readOnly: boolean;
	/** In a translation, the source's field values: a field that is the same in every language shows the source's, read only (doc 04). */
	shared?: Record<string, unknown> | null;
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
		// In a translation a field that is the same in every language is the source's: its value, read only (editor.md, a value no one changes here).
		if (shared && localeModeOf(key, def) === "same") {
			const sharedValue = shared[key];
			const labels = values[key]?.optionLabels ?? {};
			const shown = (Array.isArray(sharedValue) ? sharedValue : sharedValue === undefined ? [] : [sharedValue])
				.map((each) => labels[String(each)] ?? String(each))
				.join(", ");
			return (
				<FormField key={key}>
					<FormFieldLabel>{values[key]?.label ?? key}</FormFieldLabel>
					<Text variant="note" tone={shown ? undefined : "faint"}>
						{shown || empty}
					</Text>
					<FormFieldDescription>{t("translation.sharedField")}</FormFieldDescription>
				</FormField>
			);
		}
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
			return null;
		};
		return (
			<FormField key={key}>
				<FormFieldLabel htmlFor={id} required={marksRequired && required(key)} action={count}>
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
