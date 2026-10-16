"use client";

import { useTranslator } from "@monti-cms/core/site";
import { useId, useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { DialogFormFooter } from "../../ui/dialog-form-footer";
import { FieldError } from "../../ui/field";
import { Input } from "../../ui/input";
import { Labeled } from "../shared/labeled";
import { schemaCollectionMessages } from "./collection.messages";
import { schemaMessages } from "./messages";
import { PublicPathField } from "./public-path-field";
import { collectionNameProblem, defaultPath, idFromName, pathProblem } from "./schema-model";

type Kind = "document" | "item";

/** Display name, identifier, kind and public address of a new collection. The identifier follows the name and the address follows the identifier, each until the writer types one of their own. */
export function NewCollectionDialog({
	open,
	onOpenChange,
	taken,
	onCreate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	taken: readonly string[];
	onCreate: (id: string, kind: Kind, path: string, label: string) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent data-testid="new-collection-dialog">
				<NewCollectionForm taken={taken} onCancel={() => onOpenChange(false)} onCreate={onCreate} />
			</DialogContent>
		</Dialog>
	);
}

function NewCollectionForm({
	taken,
	onCancel,
	onCreate,
}: {
	taken: readonly string[];
	onCancel: () => void;
	onCreate: (id: string, kind: Kind, path: string, label: string) => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const tc = useTranslator(commonMessages);
	const ts = useTranslator(schemaMessages);
	const nameId = useId();
	const idFieldId = useId();
	const [name, setName] = useState("");
	// `null`: not typed yet, so the identifier is the one the name suggests.
	const [typedId, setTypedId] = useState<string | null>(null);
	const [kind, setKind] = useState<Kind>("document");
	// `null`: not typed yet, so the address is the one the identifier and kind suggest.
	const [typedPath, setTypedPath] = useState<string | null>(null);
	const id = typedId ?? idFromName(name);
	const path = typedPath ?? (kind === "document" ? defaultPath(id) : "");
	const idIssue = id === "" ? (name.trim() === "" ? null : "idEmpty") : collectionNameProblem(id, taken);
	const pathIssue = pathProblem(path);
	const ready = name.trim() !== "" && id !== "" && idIssue === null && pathIssue === null;
	const kinds: { value: Kind; label: string; explain: string }[] = [
		{ value: "document", label: ts("collection.kindDocument"), explain: t("collection.kindDocumentExplain") },
		{ value: "item", label: ts("collection.kindItem"), explain: t("collection.kindItemExplain") },
	];
	const submit = () => {
		if (ready) onCreate(id, kind, path.trim(), name.trim());
	};
	return (
		<form
			className="grid gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DialogHeader>
				<DialogTitle>{t("collection.createTitle")}</DialogTitle>
			</DialogHeader>
			<Labeled label={t("collection.newName")} htmlFor={nameId}>
				<Input
					id={nameId}
					value={name}
					placeholder="Blog posts"
					autoComplete="off"
					onChange={(event) => setName(event.target.value)}
				/>
			</Labeled>
			<Labeled label={t("collection.newId")} htmlFor={idFieldId} description={t("collection.newIdHint")}>
				<Input
					id={idFieldId}
					value={id}
					placeholder="blog-posts"
					autoComplete="off"
					aria-invalid={idIssue ? true : undefined}
					onChange={(event) => setTypedId(event.target.value)}
				/>
				{idIssue && <FieldError className="text-xs">{ts(`name.${idIssue}`)}</FieldError>}
			</Labeled>
			<fieldset className="flex flex-col gap-2">
				<legend className="mb-1.5 font-medium text-xs">{t("collection.kind")}</legend>
				{kinds.map((item) => (
					<label
						key={item.value}
						className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 has-checked:border-cms-primary has-checked:bg-cms-accent/40"
					>
						<input
							type="radio"
							name="new-collection-kind"
							value={item.value}
							checked={kind === item.value}
							onChange={() => setKind(item.value)}
							className="mt-0.5"
						/>
						<span className="flex flex-col gap-0.5">
							<span className="font-medium text-sm">{item.label}</span>
							<span className="text-cms-muted-foreground text-xs">{item.explain}</span>
						</span>
					</label>
				))}
			</fieldset>
			<PublicPathField path={path} suggested={defaultPath(id)} onChange={setTypedPath} />
			<DialogFormFooter
				onCancel={onCancel}
				cancelLabel={tc("cancel")}
				submitLabel={t("collection.createConfirm")}
				disabled={!ready}
			/>
		</form>
	);
}
