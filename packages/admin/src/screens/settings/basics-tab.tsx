import type { SchemaProblem } from "@monti-cms/core";
import {
	Affix,
	Button,
	ChangeDot,
	DangerBlock,
	FormField,
	FormFieldError,
	FormFieldLabel,
	FormFieldWas,
	Grid,
	Inline,
	Input,
	Label,
	LockMark,
	Option,
	ReadValue,
	Stack,
	Switch,
	TextButton,
} from "@monti-cms/ui";
import { useEffect, useRef } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useFocusHandOff } from "../frame/focus-hand-off";
import { at } from "./schema-draft";
import { useCell } from "./use-cell";
import type { SettingsDraft } from "./use-settings-draft";

/** "/posts/:slug" ↔ "posts": the part of a public address the person types. */
export const addressPart = (path: string) => path.replace(/^\//, "").replace(/\/?:slug$/, "");
export const addressOf = (part: string) => {
	// Kept as typed (a slash on its way to "blog/posts" too): the schema check names a path that is not one yet.
	const typed = part.trim().replace(/^\/+/, "");
	return typed ? `/${typed}/:slug` : "/:slug";
};

/**
 * A collection's basic tab (flow 4, steps 13 and 15; flow 11, step 17c): one group, in the field sheet's order: the identifier (never changes,
 * its lock on its row) and the kind side by side, the name the admin reads, the public address (the file's, locked on its row on the live site) and folders.
 * No section names the system's split between file and admin values (README principle 9). Deleting it takes it out of the list at once; the
 * review is the last check.
 */
/** One of a collection's two addresses: its public one, or its preview page's. */
export type AddressPlace = "path" | "preview";

/** The address a problem of the schema is about, when it is about one (the others are a field's or the name's). */
export function addressOfProblem(code: SchemaProblem["code"]): AddressPlace | null {
	if (code === "badPath" || code === "pathTaken") return "path";
	if (code === "badPreviewPath" || code === "previewPathTaken") return "preview";
	return null;
}

export function BasicsTab({
	model,
	collection: c,
	onDelete,
	attention = null,
	onAttended,
}: {
	model: SettingsDraft;
	collection: string;
	onDelete: () => void;
	/** The address the review's "open" asks to be fixed: its field takes the keyboard once. */
	attention?: AddressPlace | null;
	onAttended?: () => void;
}) {
	const { t } = useAdmin();
	const { draft, data } = model;
	const locked = data?.locked ?? true;
	const kind = (draft.value(at.collection(c)) as { kind: "document" | "item" } | null)?.kind ?? "document";
	const cell = useCell(model);
	// A collection made in this draft is new as a whole: its addresses carry no mark of their own. A proposed address always does.
	const marked = (shown: ReturnType<typeof cell>) =>
		shown.proposal || data?.schema.collections[c] ? shown.changed : undefined;
	const pathPlace = at.path(c);
	const pathCell = cell(pathPlace);
	const pathValue = pathCell.value;
	const path = typeof pathValue === "string" ? pathValue : kind === "document" ? "/:slug" : undefined;
	const pathChanged = marked(pathCell);
	const previewPlace = at.preview(c);
	const previewCell = cell(previewPlace);
	const preview = previewCell.value;
	const previewChanged = marked(previewCell);
	const labelPlace = at.collectionValue(c, "label");
	const foldersPlace = at.collectionValue(c, "folders");
	// What is wrong with an address is told under its field, as a field's problem is told on its row: the review's "open" leads here.
	const problemOf = (place: AddressPlace) => {
		// Two collections with one address: the schema names the later one, and it is as wrong here as there.
		const sharedWith = (other: string | undefined, code: SchemaProblem["code"]) =>
			other !== undefined &&
			((code === "pathTaken" && draft.value(at.path(other)) === pathValue) ||
				(code === "previewPathTaken" && typeof preview === "string" && draft.value(at.preview(other)) === preview));
		const problem = model.problems.find(
			(each) =>
				!each.field &&
				addressOfProblem(each.code) === place &&
				(each.collection === c || sharedWith(each.collection, each.code)),
		);
		return problem ? t(`settings.problem.${problem.code}`) : undefined;
	};
	const pathProblem = problemOf("path");
	const previewProblem = problemOf("preview");
	const attended = useRef(onAttended);
	attended.current = onAttended;
	useEffect(() => {
		if (!attention) return;
		// After the review has closed and handed the focus back to the button that opened it.
		const later = setTimeout(() => {
			document.getElementById(attention === "path" ? "collection-path" : "collection-preview-path")?.focus();
			attended.current?.();
		}, 0);
		return () => clearTimeout(later);
	}, [attention]);
	const label = cell(labelPlace);
	const folders = cell(foldersPlace);
	// A row's undo goes away with the change it puts back: the keyboard's focus it held goes to the row's own control, the one the undo acted
	// on (an item's row is its switch: the address field goes with the public page).
	const pathUndo = useFocusHandOff(() =>
		document.getElementById(kind === "item" ? "collection-public-page" : "collection-path"),
	);
	const previewUndo = useFocusHandOff(() => document.getElementById("collection-preview-path"));
	return (
		<>
			<Stack gap={24} paddingY={24}>
				<Grid columns={2} gap={24}>
					<ReadValue label={t("settings.basics.identifier")} mono>
						{c}
						<LockMark label={t("settings.basics.fixed")} />
					</ReadValue>
					<ReadValue label={t("settings.basics.kind")} mono={false}>
						{t(`settings.kind.${kind}`)}
					</ReadValue>
				</Grid>
				<FormField>
					{/* A name the assistant proposed is blue, with its discard on the label row and the saved name struck under it (doc 05). */}
					<FormFieldLabel htmlFor="collection-label" changed={label.proposal ? label.changed : undefined}>
						{t("settings.basics.label")}
					</FormFieldLabel>
					<Input
						id="collection-label"
						value={String(label.value ?? "")}
						placeholder={c}
						proposal={label.proposal}
						onChange={(event) => draft.set(labelPlace, event.target.value || undefined)}
					/>
					{label.proposal && label.was ? <FormFieldWas>{String(label.was)}</FormFieldWas> : null}
				</FormField>
				{locked ? (
					kind === "document" || path !== undefined ? (
						<ReadValue label={t("settings.basics.path")}>
							{path}
							<LockMark label={t("settings.locked")} />
						</ReadValue>
					) : (
						<ReadValue label={t("settings.basics.path")}>
							{t("settings.basics.publicPageOff")}
							<LockMark label={t("settings.locked")} />
						</ReadValue>
					)
				) : (
					// A 36px body-text row like "Use folders" below it, the address under it (collections.md). An item's row ends in the switch of its public page.
					<Stack gap={4}>
						<Inline minHeight="control-lg" align="center" justify="between" gap={12}>
							<Inline gap={8} align="center">
								<Label
									htmlFor={kind === "item" ? "collection-public-page" : "collection-path"}
									size="body"
									tone="default"
								>
									{t("settings.basics.path")}
								</Label>
								{pathChanged ? <ChangeDot tone={pathChanged.tone} label={pathChanged.label} /> : null}
							</Inline>
							<Inline gap={12} align="center">
								{pathChanged ? (
									<TextButton variant="underline" quiet size="caption" ref={pathUndo} onClick={pathChanged.onUndo}>
										{pathChanged.undoLabel}
									</TextButton>
								) : null}
								{kind === "item" ? (
									<Switch
										id="collection-public-page"
										checked={path !== undefined}
										onCheckedChange={(checked) => draft.set(pathPlace, checked ? addressOf(c) : null)}
									/>
								) : null}
							</Inline>
						</Inline>
						{path !== undefined && (
							<Affix
								id="collection-path"
								aria-label={kind === "item" ? t("settings.basics.path") : undefined}
								prefix="/"
								suffix="/:slug"
								width="fit"
								aria-invalid={pathProblem !== undefined || undefined}
								proposal={pathCell.proposal}
								value={addressPart(path)}
								onChange={(event) => draft.set(pathPlace, addressOf(event.target.value))}
							/>
						)}
						{/* A proposed address is blue, with the saved one struck under it (doc 05), as the name above. */}
						{pathCell.proposal ? (
							<FormFieldWas>
								{typeof pathCell.was === "string" ? pathCell.was : t("settings.basics.publicPageOff")}
							</FormFieldWas>
						) : null}
						{pathProblem ? <FormFieldError>{pathProblem}</FormFieldError> : null}
					</Stack>
				)}
				{/* The site's own preview page, when it made one (doc 16): a document's only, since an item has nothing to preview. */}
				{kind !== "document" ? null : locked ? (
					// An address reads in the address's letters; the words for "none" read as words.
					<ReadValue label={t("settings.basics.previewPath")} mono={typeof preview === "string"}>
						{typeof preview === "string" ? preview : t("settings.basics.previewAtPublic")}
						<LockMark label={t("settings.locked")} />
					</ReadValue>
				) : (
					<FormField>
						{/* The same line as the public address above it: the two are one kind of value. */}
						<Inline minHeight="control-lg" align="center" justify="between" gap={12}>
							<Inline gap={8} align="center">
								<Label htmlFor="collection-preview-path" size="body" tone="default">
									{t("settings.basics.previewPath")}
								</Label>
								{previewChanged ? <ChangeDot tone={previewChanged.tone} label={previewChanged.label} /> : null}
							</Inline>
							{previewChanged ? (
								<TextButton variant="underline" quiet size="caption" ref={previewUndo} onClick={previewChanged.onUndo}>
									{previewChanged.undoLabel}
								</TextButton>
							) : null}
						</Inline>
						<Affix
							id="collection-preview-path"
							prefix="/"
							suffix="/:slug"
							width="fit"
							placeholder="preview"
							aria-invalid={previewProblem !== undefined || undefined}
							proposal={previewCell.proposal}
							value={typeof preview === "string" ? addressPart(preview) : ""}
							onChange={(event) => {
								// Empty is what the field shows as empty: slashes alone leave no address, so they are none (not "/:slug").
								const address = addressOf(event.target.value);
								draft.set(previewPlace, addressPart(address) === "" ? null : address);
							}}
						/>
						{/* A proposed address is blue, with what is saved struck under it (doc 05): an address, or the words for none. */}
						{previewCell.proposal ? (
							<FormFieldWas>
								{typeof previewCell.was === "string" ? previewCell.was : t("settings.basics.previewAtPublic")}
							</FormFieldWas>
						) : null}
						{/* What leaving it empty does, only while it is empty (README principle 8); the line stays, so nothing moves when typed. */}
						<FormFieldError
							reserve
							hint={typeof preview === "string" ? undefined : t("settings.basics.previewPathHint")}
						>
							{previewProblem}
						</FormFieldError>
					</FormField>
				)}
				{/* At the height of the inputs above it (36px): one group, one control height. */}
				<Option spread height="lg">
					<Inline gap={8} align="center">
						{t("settings.basics.folders")}
						{folders.proposal ? <ChangeDot tone="proposal" label={t("settings.proposed")} /> : null}
					</Inline>
					<Switch checked={Boolean(folders.value)} onCheckedChange={(checked) => draft.set(foldersPlace, checked)} />
				</Option>
			</Stack>
			{locked ? null : (
				<DangerBlock title={t("settings.basics.delete")}>
					<Inline justify="end">
						<Button variant="outline-danger" size="sm" onClick={onDelete}>
							{t("settings.basics.deleteButton")}
						</Button>
					</Inline>
				</DangerBlock>
			)}
		</>
	);
}
