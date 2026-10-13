"use client";

import { useTranslator } from "@monti-cms/core/client";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Labeled, Pick, useSchemaEdit } from "./controls";
import { type CollectionEditing, NewFieldDialog } from "./field-editor";
import { schemaMessages } from "./messages";
import {
	addField,
	allFieldNames,
	FIELD_KINDS,
	type FieldKindName,
	type FieldPlace,
	KINDS_WITH_SETTINGS,
	newField,
	VALUE_KINDS,
} from "./schema-model";

/**
 * Adds a field in two steps: a name and a kind first; a kind that cannot exist without settings (a choice, a relation, a conditional field...) then asks for them in
 * a second dialog before the field is made. `onAdded` gets the name of the new field so the caller can open its editor.
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
	const t = useTranslator(schemaMessages);
	const { collectionNames } = useSchemaEdit();
	const [name, setName] = useState("");
	const [kind, setKind] = useState<FieldKindName>("text");
	const [pending, setPending] = useState(false);
	const kinds = place.branch ? VALUE_KINDS : FIELD_KINDS;
	const taken = allFieldNames(editing.collection);
	const problem =
		name === "" ? "empty" : taken.includes(name) ? "taken" : /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ? null : "pattern";

	const submit = () => {
		if (problem) return;
		if (KINDS_WITH_SETTINGS.includes(kind)) {
			setPending(true);
			return;
		}
		editing.update((collection) =>
			addField(collection, place, name, newField(kind, name.charAt(0).toUpperCase() + name.slice(1), collectionNames)),
		);
		onAdded(name);
	};

	if (pending) {
		return (
			<NewFieldDialog
				editing={editing}
				place={place}
				name={name}
				kind={kind}
				onClose={(added) => {
					if (added) onAdded(name);
					else onClose();
				}}
			/>
		);
	}
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md" data-testid="add-field-dialog">
				<DialogHeader>
					<DialogTitle>{t("field.addTitle")}</DialogTitle>
					<DialogDescription>{t("field.addDescription")}</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-6"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<Labeled
						label={t("field.newName")}
						hint={
							name !== "" && problem ? <span className="text-cms-destructive">{t(`name.${problem}`)}</span> : undefined
						}
					>
						<Input
							autoFocus
							value={name}
							aria-label={t("field.newName")}
							placeholder="fieldName"
							aria-invalid={name !== "" && problem ? true : undefined}
							onChange={(event) => setName(event.target.value)}
						/>
					</Labeled>
					<Pick
						label={t("field.kind")}
						value={kind}
						items={kinds.map((item) => ({ value: item, label: t(`kind.${item}`) }))}
						onChange={(next) => setKind(next as FieldKindName)}
					/>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							{t("field.newCancel")}
						</Button>
						<Button type="submit" disabled={Boolean(problem)}>
							{t("field.addConfirm")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
