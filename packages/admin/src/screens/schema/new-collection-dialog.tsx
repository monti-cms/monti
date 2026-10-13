"use client";

import { useTranslator } from "@monti-cms/core/client";
import { useId, useState } from "react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { FieldError } from "../../ui/field";
import { Input } from "../../ui/input";
import { Labeled } from "./controls";
import { schemaMessages } from "./messages";
import { defaultPath, nameProblem, pathProblem } from "./schema-model";

type Kind = "document" | "item";

/** Name, kind and public address of a new collection. The address follows the name until the writer types one of their own. */
export function NewCollectionDialog({
	open,
	onOpenChange,
	taken,
	onCreate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	taken: readonly string[];
	onCreate: (name: string, kind: Kind, path: string) => void;
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
	onCreate: (name: string, kind: Kind, path: string) => void;
}) {
	const t = useTranslator(schemaMessages);
	const nameId = useId();
	const pathId = useId();
	const [name, setName] = useState("");
	const [kind, setKind] = useState<Kind>("document");
	// `null`: not typed yet, so the address is the one the name and kind suggest.
	const [typedPath, setTypedPath] = useState<string | null>(null);
	const path = typedPath ?? (kind === "document" ? defaultPath(name) : "");
	const nameIssue = name === "" ? null : nameProblem(name, taken);
	const pathIssue = pathProblem(path);
	const ready = name !== "" && nameIssue === null && pathIssue === null;
	const kinds: { value: Kind; label: string; explain: string }[] = [
		{ value: "document", label: t("collection.kindDocument"), explain: t("collection.kindDocumentExplain") },
		{ value: "item", label: t("collection.kindItem"), explain: t("collection.kindItemExplain") },
	];
	const submit = () => {
		if (ready) onCreate(name, kind, path.trim());
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
				<DialogDescription>{t("collection.createDescription")}</DialogDescription>
			</DialogHeader>
			<Labeled label={t("collection.newName")} htmlFor={nameId} hint={t("collection.newNameHint")}>
				<Input
					id={nameId}
					value={name}
					placeholder="article"
					autoComplete="off"
					aria-invalid={nameIssue ? true : undefined}
					onChange={(event) => setName(event.target.value)}
				/>
				{nameIssue && <FieldError className="text-xs">{t(`name.${nameIssue}`)}</FieldError>}
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
			<Labeled
				label={t("collection.path")}
				htmlFor={pathId}
				hint={`${t("collection.pathHint")} ${t("collection.newPathHint")}`}
			>
				<Input
					id={pathId}
					value={path}
					placeholder="/posts/:slug"
					autoComplete="off"
					aria-invalid={pathIssue ? true : undefined}
					onChange={(event) => setTypedPath(event.target.value)}
				/>
				{pathIssue && <FieldError className="text-xs">{t(`path.${pathIssue}`)}</FieldError>}
			</Labeled>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onCancel}>
					{t("collection.createCancel")}
				</Button>
				<Button type="submit" disabled={!ready}>
					{t("collection.createConfirm")}
				</Button>
			</DialogFooter>
		</form>
	);
}
