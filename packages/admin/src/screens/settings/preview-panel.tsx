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
	Stack,
	Text,
	Textarea,
	TodoItem,
} from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { PickOne } from "./pick-one";
import { at, type DraftField, type Layout, shownLayout } from "./schema-draft";
import type { CollectionsDraft } from "./use-collections-draft";

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
 * The property panel preview (flow 4, steps 08–09): the entry editor's property panel drawn from the unsaved fields, as it will look. When the draft has
 * something to fix, the panel lists that instead and the save is blocked; a line goes to the field.
 */
export function PreviewPanel({
	model,
	collection: c,
	onClose,
	onOpenField,
}: {
	model: CollectionsDraft;
	collection: string;
	onClose: () => void;
	onOpenField: (key: string) => void;
}) {
	const { t } = useAdmin();
	const keys = model.fields(c).filter((key) => model.shown(at.field(c, key)));
	const layout = shownLayout(
		model.draft.value(at.collectionValue(c, "layout")) as Layout | undefined,
		keys,
		t("settings.fields.defaultTab"),
	);
	const [tab, setTab] = useState("0");
	const picked = layout[Number(tab)] ?? layout[0];
	const problems = model.problems.filter((problem) => problem.collection === c);
	const keyOf = (name: string) => keys.find((key) => model.fieldName(c, key) === name);

	const row = (key: string) => {
		// The title is the editor's heading, not a property (flow 1).
		if (key === "title") return null;
		const field = model.shown(at.field(c, key)) as DraftField | null;
		if (!field) return null;
		const id = `preview-${key}`;
		const placeholder = t("settings.preview.empty");
		return (
			<FormField key={key}>
				<FormFieldLabel htmlFor={id}>{model.fieldLabel(c, key)}</FormFieldLabel>
				{input(field.def, id, placeholder, key)}
			</FormField>
		);
	};
	const input = (def: FieldDefinition, id: string, placeholder: string, key: string) => {
		if (def.kind === "slug") return <Input id={id} size="md" mono placeholder={t("settings.preview.fromTitle")} />;
		if (def.kind === "text")
			return def.multiline ? (
				<Textarea id={id} size="md" placeholder={placeholder} />
			) : (
				<Input id={id} size="md" placeholder={placeholder} />
			);
		if (def.kind === "select") {
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
			tabs={layout.map((each, index) => ({ value: String(index), label: each.tab }))}
		>
			{problems.length > 0 ? (
				<Stack gap={12}>
					<Text as="p" variant="note">
						{t("settings.preview.blocked")}
					</Text>
					{problems.map((problem) => {
						const key = problem.field ? keyOf(problem.field) : undefined;
						return (
							<TodoItem
								key={`${problem.field}:${problem.code}`}
								blocking
								title={key ? model.fieldLabel(c, key) : model.label(c)}
								detail={t(`settings.problem.${problem.code}`)}
								onOpen={key ? () => onOpenField(key) : undefined}
							/>
						);
					})}
				</Stack>
			) : (
				runs(picked?.fields ?? []).map((run) => (
					<PropertyGroup key={run.key} title={run.title}>
						{run.fields.map(row)}
					</PropertyGroup>
				))
			)}
		</PropertyPanel>
	);
}
