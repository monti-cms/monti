"use client";

import { fieldTraits, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	PickList,
	PickListItem,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSplit,
	SheetTitle,
	Stack,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useState } from "react";
import { useAdminComponents } from "../../admin-components";
import { commonMessages } from "../../lib/common.messages";
import { FlagSwitch, SegmentedField, TextAreaInput, TextInput, useSchemaEdit } from "./controls";
import { type CollectionEditing, KindOptions, LOCALIZED_KINDS } from "./field-editor";
import { FieldCustomInputPicker, FieldRolePicker } from "./field-role-input";
import { fieldSheetSummary } from "./field-summary";
import { schemaFieldsMessages } from "./fields.messages";
import { schemaMessages } from "./messages";
import {
	ADDABLE_KINDS,
	addField,
	allFieldNames,
	collectionLabel,
	collectionsOf,
	FIELD_KEY_ORDER,
	type FieldPlace,
	fieldAt,
	fieldProblems,
	nameProblem,
	newField,
	type Obj,
	setProp,
	suggestedFieldName,
	withKind,
	withOpposite,
} from "./schema-model";

type AddableKind = (typeof ADDABLE_KINDS)[number];

/** How a field is spread over the languages, as the file stores it. */
const LOCALIZED_OF = (field: Obj) =>
	field.localized === true ? "localized" : field.localized === "inherit" ? "inherit" : "shared";

/**
 * Adds a field in one step, in a sheet: the kinds are a list on the left and the settings of the picked kind sit beside it under the tabs Basic and Advanced, so a
 * wrong pick is fixed by picking another. The identifier follows the display name (a relation's follows its target, and so does its name) until the writer types
 * one of their own. `onAdded` gets the name of the new field.
 */
export function AddFieldSheet({
	editing,
	place,
	onClose,
	onAdded,
}: {
	editing: CollectionEditing;
	place: FieldPlace;
	onClose: () => void;
	onAdded: (name: string) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const tc = useTranslator(commonMessages);
	const ts = useTranslator(schemaMessages);
	const { collectionNames, file } = useSchemaEdit();
	const { fieldInputs } = useAdminComponents();
	const [kind, setKind] = useState<AddableKind>("text");
	const [draft, setDraft] = useState<Obj>(() => newField("text", "", collectionNames));
	// `null` while the label (or a relation's target) names the field; set once the writer types a label or an identifier of their own.
	const [typedLabel, setTypedLabel] = useState<string | null>(null);
	const [typedName, setTypedName] = useState<string | null>(null);
	const [opposite, setOpposite] = useState(false);

	const isItem = (target: unknown) => typeof target === "string" && collectionsOf(file)[target]?.kind === "item";
	const target = typeof draft.to === "string" ? draft.to : "";
	const field =
		typedLabel === null && kind === "relation"
			? setProp(draft, "label", collectionLabel(file, target), FIELD_KEY_ORDER)
			: draft;
	const taken = allFieldNames(editing.collection);
	const name = typedName ?? suggestedFieldName(field, taken);
	const collection = addField(editing.collection, place, name, field);
	const problems = fieldProblems(field, collection, collectionNames);
	const problem = nameProblem(name, taken);
	const label = typeof field.label === "string" ? field.label : "";
	const ready = !problem && problems.length === 0 && label.trim() !== "";
	const valueKind = fieldTraits[kind].entersValue;

	const change = (update: (field: Obj) => Obj) => setDraft((current) => update(current));
	const set = (key: string, value: unknown) =>
		change((current) => {
			const next = setProp(current, key, value, FIELD_KEY_ORDER);
			// A new link to items (tags, categories) lets the writer add one from the input; a link to documents does not.
			return key === "to" ? setProp(next, "createInline", isItem(value) ? true : undefined, FIELD_KEY_ORDER) : next;
		});
	// The fields of a select's options are edited in the collection with the new field in it; only the field is kept.
	const draftEditing: CollectionEditing = {
		...editing,
		collection,
		update: (apply) =>
			setDraft((current) => fieldAt(apply(addField(editing.collection, place, name, current)), place, name) ?? current),
		onRename: () => undefined,
	};
	const pickKind = (next: AddableKind) => {
		setKind(next);
		setDraft((current) => {
			const changed = withKind(current, next, collectionNames);
			return next === "relation"
				? setProp(changed, "createInline", isItem(changed.to) ? true : undefined, FIELD_KEY_ORDER)
				: changed;
		});
	};
	const add = () => {
		if (!ready) return;
		editing.update((current) => addField(current, place, name, field));
		if (opposite && field.kind === "relation" && field.many === true)
			editing.updateFile?.((current) => withOpposite(current, editing.collectionName, name, target, true));
		onAdded(name);
	};
	const collectionTitle =
		typeof editing.collection.label === "string" ? editing.collection.label : editing.collectionName;
	const oppositeSwitch = !place.branch && editing.updateFile ? { on: opposite, onChange: setOpposite } : undefined;
	const hasPluginInputs = Object.keys(fieldInputs ?? {}).length > 0;

	return (
		<Sheet open onOpenChange={(open) => !open && onClose()}>
			<SheetContent data-testid="add-field-sheet">
				<Stack
					as="form"
					gap={0}
					grow
					minHeight={0}
					onSubmit={(event) => {
						event.preventDefault();
						add();
					}}
				>
					<SheetHeader>
						<SheetTitle of={`· ${collectionTitle}`}>{t("field.addTitle")}</SheetTitle>
					</SheetHeader>
					<SheetSplit
						list={
							<PickList aria-label={t("field.kind")}>
								{ADDABLE_KINDS.map((item) => (
									<PickListItem
										key={item}
										selected={item === kind}
										aria-label={t(`kind.${item}`)}
										mark={item === "relation" ? "→" : undefined}
										onClick={() => pickKind(item)}
									>
										{t(`kind.${item}`)}
									</PickListItem>
								))}
							</PickList>
						}
					>
						<Tabs defaultValue="basic" render={<Stack gap={0} grow minHeight={0} />}>
							<TabsList variant="bar" inset="panel">
								<TabsTrigger value="basic">{t("sheet.tabBasic")}</TabsTrigger>
								<TabsTrigger value="advanced">{t("sheet.tabAdvanced")}</TabsTrigger>
							</TabsList>
							<SheetBody>
								<TabsContent value="basic">
									<Stack gap={16}>
										<TextInput
											label={t("field.label")}
											required
											value={label}
											onChange={(value) => {
												setTypedLabel(value);
												change((current) => setProp(current, "label", value, FIELD_KEY_ORDER));
											}}
										/>
										<TextInput
											label={t("field.name")}
											required
											mono
											value={name}
											error={typedName !== null && problem ? ts(`name.${problem}`) : undefined}
											onChange={setTypedName}
										/>
										<TextAreaInput
											label={t("field.description")}
											value={field.description as string | undefined}
											onChange={(value) =>
												change((current) =>
													setProp(current, "description", value === "" ? undefined : value, FIELD_KEY_ORDER),
												)
											}
										/>
										<KindOptions
											name={name}
											field={field}
											editing={draftEditing}
											set={set}
											change={change}
											place={place}
											opposite={oppositeSwitch}
										/>
										{valueKind && field.kind !== "conditional" && (
											<FlagSwitch
												label={t("field.required")}
												mark="!"
												checked={field.required === true}
												onChange={(on) => set("required", on ? true : undefined)}
											/>
										)}
										{LOCALIZED_KINDS.includes(String(field.kind)) && (
											<SegmentedField
												label={t("field.localized")}
												value={LOCALIZED_OF(field)}
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
										{problems.length > 0 && (
											<Stack as="ul" gap={2} data-testid="new-field-problems">
												{problems.map((item) => (
													<Text as="li" variant="caption" tone="muted" key={item}>
														{t(`field.needs.${item}`)}
													</Text>
												))}
											</Stack>
										)}
										<Box background="tool" radius="lg" paddingX={16} paddingY={12} data-testid="field-sheet-summary">
											<Text variant="meta" tone="muted">
												{fieldSheetSummary(t, name, field, file)}
											</Text>
										</Box>
									</Stack>
								</TabsContent>
								<TabsContent value="advanced">
									<Stack gap={16}>
										<KindOptions
											name={name}
											field={field}
											editing={draftEditing}
											set={set}
											change={change}
											place={place}
											opposite={oppositeSwitch}
											part="advanced"
										/>
										{valueKind && (
											<FieldRolePicker
												role={field.role as string | undefined}
												kind={kind}
												isTitle={false}
												onChange={(role) => set("role", role)}
											/>
										)}
										{valueKind && hasPluginInputs && (
											<FieldCustomInputPicker
												value={field.input as string | undefined}
												options={field.inputOptions}
												onChangeInput={(input) => set("input", input)}
												onChangeOptions={(opts) => set("inputOptions", opts)}
											/>
										)}
									</Stack>
								</TabsContent>
							</SheetBody>
						</Tabs>
					</SheetSplit>
					<SheetFooter>
						<TextButton onClick={onClose}>{tc("cancel")}</TextButton>
						<Button type="submit" disabled={!ready}>
							{t("field.add")}
						</Button>
					</SheetFooter>
				</Stack>
			</SheetContent>
		</Sheet>
	);
}
