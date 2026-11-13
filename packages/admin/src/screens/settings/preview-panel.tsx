import type { FieldDefinition } from "@monti-cms/core";
import {
	Combobox,
	ComboboxInput,
	FormField,
	FormFieldLabel,
	Input,
	MediaInput,
	PropertyGroup,
	PropertyPanel,
	Text,
	Textarea,
} from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import type { EntryView } from "../../plugins";
import { PickOne } from "./pick-one";
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

	const row = (key: string) => {
		// The title is the editor's heading, not a property (flow 1).
		if (key === "title") return null;
		const field = model.shown(at.field(c, key)) as DraftField | null;
		if (!field) return null;
		const id = `preview-${key}`;
		const placeholder = t("settings.preview.empty");
		return (
			<FormField key={key}>
				<FormFieldLabel htmlFor={id} required={marksRequired && Boolean(field.def.required)}>
					{model.fieldLabel(c, key)}
				</FormFieldLabel>
				{input(field.def, id, placeholder, key)}
			</FormField>
		);
	};
	const input = (def: FieldDefinition, id: string, placeholder: string, key: string) => {
		if (def.kind === "slug") return <Input id={id} size="md" mono placeholder={placeholder} />;
		if (def.kind === "text")
			return def.multiline ? (
				<Textarea id={id} size="md" placeholder={placeholder} />
			) : (
				<Input id={id} size="md" placeholder={placeholder} />
			);
		// A conditional field (doc 19) is its choice: with nothing chosen, none of its options' fields is the entry's.
		if (def.kind === "select" || def.kind === "conditional") {
			const labels = (model.shown(at.fieldValue(c, key, "optionLabels")) ?? {}) as Record<string, string>;
			return (
				<PickOne
					id={id}
					size="md"
					items={def.options.map((option) => ({ value: option, label: labels[option] ?? option }))}
					value={null}
					onChange={() => {}}
					placeholder={placeholder}
				/>
			);
		}
		if (def.kind === "relation")
			return (
				<Combobox items={[]}>
					<ComboboxInput id={id} size="md" placeholder={t("settings.preview.none")} />
				</Combobox>
			);
		return <MediaInput id={id} size="md" placeholder={t("settings.preview.empty")} />;
	};

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
						return (
							<FormField key={field.name}>
								<FormFieldLabel htmlFor={id}>{field.label ?? field.name}</FormFieldLabel>
								{Own ? (
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
								) : (
									input(definition, id, t("settings.preview.empty"), field.name)
								)}
							</FormField>
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
