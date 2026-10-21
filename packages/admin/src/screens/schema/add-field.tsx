"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Image, Link2, ListChecks, type LucideIcon, Type } from "lucide-react";
import { useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { DialogFormFooter } from "../../ui/dialog-form-footer";
import { Input } from "../../ui/input";
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
 * Adds a field in one step: picking a kind shows its settings right below, so a wrong pick is fixed by picking another. The identifier follows the label (a
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
		<div className="flex flex-col gap-5">
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
				hint={
					typedName !== null && problem ? (
						<span className="text-monti-destructive">{ts(`name.${problem}`)}</span>
					) : undefined
				}
			>
				{isNaming ? (
					<Input
						autoFocus
						value={name}
						aria-label={t("field.identifier")}
						aria-invalid={problem ? true : undefined}
						className="font-mono"
						onChange={(event) => setTypedName(event.target.value)}
					/>
				) : (
					<div className="flex items-center gap-2 text-sm">
						<code>{name}</code>
						<Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => setIsNaming(true)}>
							{t("field.identifierChange")}
						</Button>
					</div>
				)}
			</Labeled>
		</div>
	);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-testid="add-field-dialog">
				<DialogHeader>
					<DialogTitle>{t("field.addTitle")}</DialogTitle>
				</DialogHeader>
				<form
					className="flex flex-col gap-6"
					onSubmit={(event) => {
						event.preventDefault();
						add();
					}}
				>
					<div role="radiogroup" aria-label={t("field.kind")} className="grid grid-cols-4 gap-2">
						{ADDABLE_KINDS.map((item) => {
							const Icon = KIND_ICONS[item];
							return (
								// biome-ignore lint/a11y/useSemanticElements: the kinds are drawn as cards; a native radio cannot be styled as one
								<button
									key={item}
									type="button"
									role="radio"
									aria-checked={item === kind}
									onClick={() => pickKind(item)}
									className={cn(
										"flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-monti-ring/50",
										item === kind
											? "border-monti-primary bg-monti-accent font-medium text-monti-foreground"
											: "text-monti-muted-foreground hover:bg-monti-muted",
									)}
								>
									<Icon aria-hidden className="size-4" />
									{t(`kind.${item}`)}
								</button>
							);
						})}
					</div>
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
						<ul className="flex flex-col gap-0.5 text-monti-muted-foreground text-xs" data-testid="new-field-problems">
							{problems.map((item) => (
								<li key={item}>{t(`field.needs.${item}`)}</li>
							))}
						</ul>
					)}
					<DialogFormFooter
						onCancel={onClose}
						cancelLabel={tc("cancel")}
						submitLabel={tc("add")}
						disabled={Boolean(problem) || problems.length > 0 || label.trim() === ""}
					/>
				</form>
			</DialogContent>
		</Dialog>
	);
}
