import {
	Affix,
	Button,
	DangerBlock,
	DangerRow,
	FormField,
	FormFieldLabel,
	Grid,
	Inline,
	Input,
	LockMark,
	Option,
	ReadValue,
	Section,
	Switch,
} from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
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
 * A collection's basic tab (flow 4, steps 13 and 15; flow 11, step 17c): its view (name, folders) is an admin value and always editable; its
 * structure (identifier, kind, public address) is the file's, locked on the live site. Deleting it takes it out of the list at once; the review is the
 * last check.
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
	const path = String(draft.value(pathPlace) ?? "/:slug");
	const labelPlace = at.collectionValue(c, "label");
	const foldersPlace = at.collectionValue(c, "folders");
	const lock = t("settings.basics.fixed");
	return (
		<>
			<Section title={t("settings.basics.view")} stacked>
				<FormField>
					<FormFieldLabel htmlFor="collection-label">{t("settings.basics.label")}</FormFieldLabel>
					<Input
						id="collection-label"
						value={String(draft.value(labelPlace) ?? "")}
						placeholder={c}
						onChange={(event) => draft.set(labelPlace, event.target.value || undefined)}
					/>
				</FormField>
				<Option spread>
					{t("settings.basics.folders")}
					<Switch
						checked={Boolean(draft.value(foldersPlace))}
						onCheckedChange={(checked) => draft.set(foldersPlace, checked)}
					/>
				</Option>
			</Section>
			<Section
				title={
					locked ? (
						<Inline gap={6} align="center">
							{t("settings.basics.structure")}
							<LockMark label={t("settings.locked")} />
						</Inline>
					) : (
						t("settings.basics.structure")
					)
				}
				stacked
				last
			>
				<Grid columns={2} gap={24}>
					<ReadValue label={t("settings.basics.identifier")} mono>
						{c}
						<LockMark label={lock} />
					</ReadValue>
					<ReadValue label={t("settings.basics.kind")} mono={false}>
						{t(`settings.kind.${kind}`)}
					</ReadValue>
				</Grid>
				{locked ? (
					<ReadValue label={t("settings.basics.path")}>{path}</ReadValue>
				) : (
					<FormField>
						<FormFieldLabel
							htmlFor="collection-path"
							changed={
								model.changed.includes(pathPlace) && data?.schema.collections[c]
									? {
											label: t("settings.changed"),
											undoLabel: t("settings.undo"),
											onUndo: () => draft.revert(pathPlace),
										}
									: undefined
							}
						>
							{t("settings.basics.path")}
						</FormFieldLabel>
						<Affix
							id="collection-path"
							prefix="/"
							suffix="/:slug"
							width="fit"
							value={addressPart(path)}
							onChange={(event) => draft.set(pathPlace, addressOf(event.target.value))}
						/>
					</FormField>
				)}
			</Section>
			{locked ? null : (
				<DangerBlock title={t("settings.basics.delete")}>
					<DangerRow
						name={model.label(c)}
						action={
							<Button variant="outline-danger" size="sm" onClick={onDelete}>
								{t("settings.basics.deleteButton")}
							</Button>
						}
					/>
				</DangerBlock>
			)}
		</>
	);
}
