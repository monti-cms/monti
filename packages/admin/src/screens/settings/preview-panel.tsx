import type { FieldDefinition } from "@monti-cms/core";
import { MediaInput, PropertyGroup, PropertyPanel, Text } from "@monti-cms/ui";
import { useState } from "react";
import { fieldName } from "../../format/names";
import { useAdmin } from "../../operations/admin-context";
import type { EntryView } from "../../plugins";
import { FieldInput, FieldToggle, standsAsSwitch } from "../entry/field-input";
import { PropertyRow } from "../entry/property-row";
import { at, type DraftField, type Layout, shownLayout } from "./schema-draft";
import type { SettingsDraft } from "./use-settings-draft";

/** A tab's entries as the panel groups them: the loose fields between groups run together, each group under its name. */
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

/**
 * The property panel preview (flow 4, step 08): the entry editor's property panel drawn from the unsaved fields, as it will look, problems and all (a
 * select with no choices is an empty select). What is to fix is told when saving, at the top of the review.
 */
export function PreviewPanel({
	model,
	collection: c,
	onClose,
}: {
	model: SettingsDraft;
	collection: string;
	onClose: () => void;
}) {
	const { t, inputs, siteName } = useAdmin();
	const keys = model.topFields(c).filter((key) => model.shown(at.field(c, key)));
	const layout = shownLayout(
		model.draft.value(at.collectionValue(c, "layout")) as Layout | undefined,
		keys,
		t("settings.fields.defaultTab"),
	);
	// The plugins' tabs come after the collection's own, as the editor has them (doc 14): their fields, drawn empty like the rest.
	const pluginTabs = model.data?.pluginTabs?.[c] ?? [];
	const tabs = [...layout.map((each) => each.tab), ...pluginTabs.map((each) => each.tab)];
	/** An entry with nothing in it, for the plugins' inputs: the collection's fields by name, each empty. */
	const emptyEntry: EntryView = {
		collection: c,
		locale: null,
		title: "",
		slug: "",
		values: Object.fromEntries(keys.map((key) => [key, undefined])),
		address: null,
		labels: Object.fromEntries(keys.map((key) => [key, model.fieldLabel(c, key)])),
		siteName,
	};
	/** What was tried in the plugins' inputs: the preview's inputs take typing like the editor's, and keep none of it. */
	const [typed, setTyped] = useState<Record<string, unknown>>({});
	const [tab, setTab] = useState("0");
	const picked = layout[Number(tab)] ?? (Number(tab) < tabs.length ? undefined : layout[0]);
	const pluginTab = pluginTabs[Number(tab) - layout.length];

	// The editor's rule for required fields (components/field.md): a red * after the label, but only in a panel that also has fields left empty.
	const defs = keys
		.filter((key) => key !== "title")
		.flatMap((key) => {
			const field = model.shown(at.field(c, key)) as DraftField | null;
			return field ? [field.def] : [];
		});
	const marksRequired = defs.some((def) => !def.required);

	/**
	 * A field's row as the editor's panel draws it, with nothing in it: a choice made by a switch is a row with the switch at its end, every
	 * other kind its label over its input.
	 */
	const fieldRow = (key: string, def: FieldDefinition, label: string, required: boolean) => {
		const id = `preview-${key}`;
		return (
			<PropertyRow
				key={key}
				id={id}
				name={label}
				required={required}
				toggle={
					standsAsSwitch(def, false) ? (
						<FieldToggle
							def={def}
							id={id}
							value={typed[key] ?? null}
							onChange={(next) => setTyped((was) => ({ ...was, [key]: next }))}
							readOnly={false}
						/>
					) : undefined
				}
			>
				{input(def, id, key)}
			</PropertyRow>
		);
	};
	const row = (key: string) => {
		// The title is the editor's heading, not a property (flow 1).
		if (key === "title") return null;
		const field = model.shown(at.field(c, key)) as DraftField | null;
		if (!field) return null;
		return fieldRow(key, field.def, model.fieldLabel(c, key), marksRequired && Boolean(field.def.required));
	};
	// The kind's input, the one the entry editor's panel draws (field-input.tsx): the two cannot look different. What is typed is held while the
	// preview is open and kept nowhere; a related item has no candidates, since a field that is not saved has none to read.
	const input = (def: FieldDefinition, id: string, key: string) =>
		def.kind === "media" ? (
			<MediaInput id={id} size="md" placeholder={t("settings.preview.empty")} accept={def.accept} />
		) : (
			<FieldInput
				def={def}
				id={id}
				value={typed[key] ?? null}
				onChange={(next) => setTyped((was) => ({ ...was, [key]: next }))}
				placeholder={t("settings.preview.empty")}
				readOnly={false}
				optionLabels={(model.shown(at.fieldValue(c, key, "optionLabels")) ?? {}) as Record<string, string>}
				relation={null}
			/>
		);

	return (
		<PropertyPanel
			label={t("settings.preview.title")}
			title={
				<>
					{t("settings.preview.title")}{" "}
					<Text tone="faint" weight="role">
						{t("settings.preview.unsaved")}
					</Text>
				</>
			}
			onClose={onClose}
			value={tab}
			onValueChange={setTab}
			tabs={tabs.map((each, index) => ({ value: String(index), label: each }))}
		>
			{pluginTab ? (
				<PropertyGroup>
					{pluginTab.fields.map((field) => {
						const definition = field.definition;
						// A view holds no value: it is the plugin's to draw, in the editor.
						if (!definition) return null;
						const id = `preview-${field.name}`;
						// As the editor draws it (collections.md, the preview): the input its plugin brought, on an entry with nothing in it;
						// the kind's own input when none is brought.
						const brought = definition.input ? inputs.get(definition.input) : undefined;
						const Own = brought === undefined ? null : "Input" in brought ? brought.Input : brought;
						if (!Own) return fieldRow(field.name, definition, fieldName(field.name, field.label, t), false);
						const input = (
							<Own
								id={id}
								field={field.name}
								definition={definition}
								options={definition.inputOptions ?? {}}
								value={typed[field.name]}
								onChange={(next) => setTyped((was) => ({ ...was, [field.name]: next }))}
								readOnly={false}
								proposal={false}
								entry={emptyEntry}
							/>
						);
						// The same rule as the entry's panel: a plugin's switch is a switch row.
						return (
							<PropertyRow
								key={field.name}
								id={id}
								name={fieldName(field.name, field.label, t)}
								toggle={
									standsAsSwitch(definition, brought !== undefined && "Input" in brought && brought.switch === true)
										? input
										: undefined
								}
							>
								{input}
							</PropertyRow>
						);
					})}
				</PropertyGroup>
			) : null}
			{runs(picked?.fields ?? []).map((run) => (
				<PropertyGroup key={run.key} title={run.title}>
					{run.fields.map(row)}
				</PropertyGroup>
			))}
		</PropertyPanel>
	);
}
