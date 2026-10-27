"use client";

import { useTranslator } from "@monti-cms/core/site";
import {
	ChoiceCard,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	Grid,
	Inline,
	Input,
	Stack,
	Text,
	TextLink,
} from "@monti-cms/ui";
import { Image, Link2, ListChecks, type LucideIcon, Type } from "lucide-react";
import { useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { Labeled } from "../shared/labeled";
import { TextInput, useSchemaEdit } from "./controls";
import { type CollectionEditing, KindOptions } from "./field-editor";
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

const KIND_ICONS: Readonly<Record<AddableKind, LucideIcon>> = {
	text: Type,
	select: ListChecks,
	media: Image,
	relation: Link2,
};

/**
 * Adds a field in one step: the kinds are a list on the left and the settings of the picked kind sit beside it, so a wrong pick is fixed by picking another. The identifier follows the label (a
 * relation's follows its target, and so does its label) until the writer changes it. `onAdded` gets the name of the new field.
 */
export function AddFieldDialog({
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
	const [kind, setKind] = useState<AddableKind>("text");
	const [draft, setDraft] = useState<Obj>(() => newField("text", "", collectionNames));
	// `null` while the label (or a relation's target) names the field; set once the writer types a label or an identifier of their own.
	const [typedLabel, setTypedLabel] = useState<string | null>(null);
	const [typedName, setTypedName] = useState<string | null>(null);
	const [isNaming, setIsNaming] = useState(false);
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
		if (problem || problems.length > 0 || label.trim() === "") return;
		editing.update((current) => addField(current, place, name, field));
		if (opposite && field.kind === "relation" && field.many === true)
			editing.updateFile?.((current) => withOpposite(current, editing.collectionName, name, target, true));
		onAdded(name);
	};

	const naming = (
		<Stack gap={16}>
			<TextInput
				label={t("field.label")}
				value={label}
				onChange={(value) => {
					setTypedLabel(value);
					change((current) => setProp(current, "label", value, FIELD_KEY_ORDER));
				}}
			/>
			<Labeled
				label={t("field.identifier")}
				hint={typedName !== null && problem ? <Text tone="danger">{ts(`name.${problem}`)}</Text> : undefined}
			>
				{isNaming ? (
					<Input
						autoFocus
						value={name}
						aria-label={t("field.identifier")}
						aria-invalid={problem ? true : undefined}
						mono
						onChange={(event) => setTypedName(event.target.value)}
					/>
				) : (
					<Inline gap={8}>
						<Text as="code" variant="label" mono>
							{name}
						</Text>
						<TextLink
							render={<button type="button" />}
							tone="accent"
							underline="hover"
							size="caption"
							onClick={() => setIsNaming(true)}
						>
							{t("field.identifierChange")}
						</TextLink>
					</Inline>
				)}
			</Labeled>
		</Stack>
	);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="xl" scroll data-testid="add-field-dialog">
				<DialogHeader>
					<DialogTitle>{t("field.addTitle")}</DialogTitle>
					<DialogDescription>{t("field.addDescription")}</DialogDescription>
				</DialogHeader>
				<Stack
					as="form"
					gap={24}
					onSubmit={(event) => {
						event.preventDefault();
						add();
					}}
				>
					<Grid columns="sidebar" gap={24} align="start">
						<Stack role="radiogroup" aria-label={t("field.kind")} gap={4}>
							{ADDABLE_KINDS.map((item) => {
								const Icon = KIND_ICONS[item];
								return (
									<ChoiceCard
										key={item}
										role="radio"
										aria-checked={item === kind}
										aria-label={t(`kind.${item}`)}
										icon={<Icon aria-hidden />}
										title={t(`kind.${item}`)}
										hint={t(`kind.${item}.hint`)}
										selected={item === kind}
										onClick={() => pickKind(item)}
									/>
								);
							})}
						</Stack>
						<Stack gap={24} minWidth={0} border="left" paddingX={24}>
							{kind !== "relation" && naming}
							<KindOptions
								name={name}
								field={field}
								editing={draftEditing}
								set={set}
								change={change}
								place={place}
								opposite={!place.branch && editing.updateFile ? { on: opposite, onChange: setOpposite } : undefined}
								more={kind === "relation" ? naming : undefined}
							/>
							{problems.length > 0 && (
								<Stack as="ul" gap={2} data-testid="new-field-problems">
									{problems.map((item) => (
										<Text as="li" variant="caption" tone="muted" key={item}>
											{t(`field.needs.${item}`)}
										</Text>
									))}
								</Stack>
							)}
						</Stack>
					</Grid>
					<DialogFormFooter
						onCancel={onClose}
						cancelLabel={tc("cancel")}
						submitLabel={tc("add")}
						disabled={Boolean(problem) || problems.length > 0 || label.trim() === ""}
					/>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}
