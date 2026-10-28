"use client";

import { useTranslator } from "@monti-cms/core/site";
import {
	Button,
	FormFieldLegend,
	FormFieldSet,
	LockMark,
	RadioGroup,
	RadioItem,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Stack,
	TextButton,
} from "@monti-cms/ui";
import { useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { schemaCollectionMessages } from "./collection.messages";
import { TextInput } from "./controls";
import { schemaMessages } from "./messages";
import { type NewCollectionKind, newCollectionForm } from "./new-collection";
import { PublicPathField } from "./public-path-field";
import { defaultPath } from "./schema-model";

/** The sheet that asks for the display name, identifier, kind and public address of a new collection. */
export function NewCollectionSheet({
	open,
	onOpenChange,
	taken,
	onCreate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	taken: readonly string[];
	onCreate: (id: string, kind: NewCollectionKind, path: string, label: string) => void;
}) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent data-testid="new-collection-sheet">
				<NewCollectionForm taken={taken} onCancel={() => onOpenChange(false)} onCreate={onCreate} />
			</SheetContent>
		</Sheet>
	);
}

/** The form lives inside the sheet, so what was typed is gone when the sheet closes. The identifier follows the name and the address follows the identifier, each until the writer types one of their own. */
function NewCollectionForm({
	taken,
	onCancel,
	onCreate,
}: {
	taken: readonly string[];
	onCancel: () => void;
	onCreate: (id: string, kind: NewCollectionKind, path: string, label: string) => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const tc = useTranslator(commonMessages);
	const ts = useTranslator(schemaMessages);
	const [name, setName] = useState("");
	// `null`: not typed yet, so the value is the one the name (or the identifier) suggests.
	const [typedId, setTypedId] = useState<string | null>(null);
	const [kind, setKind] = useState<NewCollectionKind>("document");
	const [typedPath, setTypedPath] = useState<string | null>(null);
	const form = newCollectionForm({ name, typedId, kind, typedPath, taken });
	return (
		<Stack
			as="form"
			gap={0}
			grow
			minHeight={0}
			onSubmit={(event) => {
				event.preventDefault();
				if (form.ready) onCreate(form.id, kind, form.path.trim(), name.trim());
			}}
		>
			<SheetHeader>
				<SheetTitle>{t("collection.createTitle")}</SheetTitle>
			</SheetHeader>
			<SheetBody>
				<TextInput label={t("collection.newName")} required value={name} onChange={setName} />
				<TextInput
					label={t("collection.newId")}
					required
					mono
					aside={<LockMark label={t("collection.newIdLocked")} flush />}
					value={form.id}
					error={form.idIssue ? ts(`name.${form.idIssue}`) : undefined}
					onChange={setTypedId}
				/>
				<FormFieldSet>
					<FormFieldLegend variant="field">{t("collection.kind")}</FormFieldLegend>
					<RadioGroup
						aria-label={t("collection.kind")}
						value={kind}
						onValueChange={(next) => setKind(next as NewCollectionKind)}
					>
						<RadioItem
							value="document"
							label={ts("collection.kindDocument")}
							description={t("collection.kindDocumentExplain")}
						/>
						<RadioItem value="item" label={ts("collection.kindItem")} description={t("collection.kindItemExplain")} />
					</RadioGroup>
				</FormFieldSet>
				<PublicPathField path={form.path} suggested={defaultPath(form.id)} onChange={setTypedPath} />
			</SheetBody>
			<SheetFooter>
				<TextButton onClick={onCancel}>{tc("cancel")}</TextButton>
				<Button type="submit" disabled={!form.ready}>
					{t("collection.createConfirm")}
				</Button>
			</SheetFooter>
		</Stack>
	);
}
