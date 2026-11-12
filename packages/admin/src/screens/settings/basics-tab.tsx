import {
	Affix,
	Button,
	ChangeDot,
	DangerBlock,
	FormField,
	FormFieldLabel,
	Grid,
	Inline,
	Input,
	LockMark,
	Option,
	ReadValue,
	Stack,
	Switch,
} from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { at } from "./schema-draft";
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
export function BasicsTab({
	model,
	collection: c,
	onDelete,
}: {
	model: SettingsDraft;
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
				) : kind === "item" ? (
					// An item's public page is a switch; its address shows under it while it is on. The switch row is 36px, as the inputs above it.
					<Stack gap={4}>
						<Option spread height="lg">
							<Inline gap={8} align="center">
								{t("settings.basics.path")}
								{pathChanged ? <ChangeDot label={pathChanged.label} /> : null}
							</Inline>
							<Switch
								checked={path !== undefined}
								onCheckedChange={(checked) => draft.set(pathPlace, checked ? addressOf(c) : null)}
							/>
						</Option>
						{path !== undefined && (
							<Affix
								id="collection-path"
								aria-label={t("settings.basics.path")}
								prefix="/"
								suffix="/:slug"
								width="fit"
								value={addressPart(path)}
								onChange={(event) => draft.set(pathPlace, addressOf(event.target.value))}
							/>
						)}
					</Stack>
				) : (
					<FormField>
						<FormFieldLabel htmlFor="collection-path" changed={pathChanged}>
							{t("settings.basics.path")}
						</FormFieldLabel>
						<Affix
							id="collection-path"
							prefix="/"
							suffix="/:slug"
							width="fit"
							value={addressPart(path ?? "/:slug")}
							onChange={(event) => draft.set(pathPlace, addressOf(event.target.value))}
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
