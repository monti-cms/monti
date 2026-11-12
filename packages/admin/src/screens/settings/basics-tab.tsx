import {
	Affix,
	Button,
	ChangeDot,
	DangerBlock,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Grid,
	Input,
	LockMark,
	Option,
	ReadValue,
	Stack,
	Switch,
	TextButton,
} from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { useFocusHandOff } from "../frame/focus-hand-off";
import { at } from "./schema-draft";
import type { CollectionsDraft } from "./use-collections-draft";

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
export function BasicsTab({
	model,
	collection: c,
	onDelete,
}: {
	model: CollectionsDraft;
	collection: string;
	onDelete: () => void;
}) {
	const { t } = useAdmin();
	const { draft, data } = model;
	const locked = data?.locked ?? true;
	const kind = (draft.value(at.collection(c)) as { kind: "document" | "item" } | null)?.kind ?? "document";
	const pathPlace = at.path(c);
	const pathValue = draft.value(pathPlace);
	const path = typeof pathValue === "string" ? pathValue : kind === "document" ? "/:slug" : undefined;
	const previewPlace = at.preview(c);
	const preview = draft.value(previewPlace);
	const previewChanged = model.changed.includes(previewPlace) && Boolean(data?.schema.collections[c]);
	const labelPlace = at.collectionValue(c, "label");
	const foldersPlace = at.collectionValue(c, "folders");
	const pathChanged =
		model.changed.includes(pathPlace) && data?.schema.collections[c]
			? {
					label: t("settings.changed"),
					undoLabel: t("settings.undo"),
					onUndo: () => draft.revert(pathPlace),
				}
			: undefined;
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
					<FormFieldLabel htmlFor="collection-label">{t("settings.basics.label")}</FormFieldLabel>
					<Input
						id="collection-label"
						value={String(draft.value(labelPlace) ?? "")}
						placeholder={c}
						onChange={(event) => draft.set(labelPlace, event.target.value || undefined)}
					/>
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
					<FormField>
						<div className="flex min-h-monti-control-lg items-center gap-monti-8">
							<label
								htmlFor={kind === "item" ? "collection-public-page" : "collection-path"}
								className="cursor-pointer text-monti-body"
							>
								{t("settings.basics.path")}
							</label>
							{pathChanged ? <ChangeDot label={pathChanged.label} /> : null}
							{pathChanged?.onUndo || kind === "item" ? (
								<div className="ml-auto flex items-center gap-monti-12">
									{pathChanged?.onUndo ? (
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
								</div>
							) : null}
						</div>
						{path !== undefined && (
							<Affix
								id="collection-path"
								aria-label={kind === "item" ? t("settings.basics.path") : undefined}
								prefix="/"
								suffix="/:slug"
								width="fit"
								value={addressPart(path)}
								onChange={(event) => draft.set(pathPlace, addressOf(event.target.value))}
							/>
						)}
					</FormField>
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
						<div className="flex min-h-monti-control-lg items-center gap-monti-8">
							<label htmlFor="collection-preview-path" className="cursor-pointer text-monti-body">
								{t("settings.basics.previewPath")}
							</label>
							{previewChanged ? <ChangeDot label={t("settings.changed")} /> : null}
							{previewChanged ? (
								<div className="ml-auto flex items-center gap-monti-12">
									<TextButton
										variant="underline"
										quiet
										size="caption"
										ref={previewUndo}
										onClick={() => draft.revert(previewPlace)}
									>
										{t("settings.undo")}
									</TextButton>
								</div>
							) : null}
						</div>
						<Affix
							id="collection-preview-path"
							prefix="/"
							suffix="/:slug"
							width="fit"
							placeholder="preview"
							value={typeof preview === "string" ? addressPart(preview) : ""}
							onChange={(event) => {
								// Empty is what the field shows as empty: slashes alone leave no address, so they are none (not "/:slug").
								const address = addressOf(event.target.value);
								draft.set(previewPlace, addressPart(address) === "" ? null : address);
							}}
						/>
						{/* What leaving it empty does, only while it is empty (README principle 8); the line stays, so nothing moves when typed. */}
						<FormFieldError
							reserve
							hint={typeof preview === "string" ? undefined : t("settings.basics.previewPathHint")}
						/>
					</FormField>
				)}
				{/* At the height of the inputs above it (36px): one group, one control height. */}
				<Option spread height="lg">
					{t("settings.basics.folders")}
					<Switch
						checked={Boolean(draft.value(foldersPlace))}
						onCheckedChange={(checked) => draft.set(foldersPlace, checked)}
					/>
				</Option>
			</Stack>
			{locked ? null : (
				<DangerBlock title={t("settings.basics.delete")}>
					<div className="flex justify-end">
						<Button variant="outline-danger" size="sm" onClick={onDelete}>
							{t("settings.basics.deleteButton")}
						</Button>
					</div>
				</DangerBlock>
			)}
		</>
	);
}
