import {
	Button,
	ChangeLine,
	ChangeLines,
	FormFieldLegend,
	FormFieldSet,
	MapRow,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Stack,
	Text,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { useUndo } from "../../activity/use-undo";
import type { useImport } from "../../data/use-import";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf } from "../../operations/use-operation";
import { linkTo, type Route } from "../../route";
import { PickOne } from "../settings/pick-one";

/** The select's value for a key that is left out: no field is called this (a field's name is an identifier). */
const SKIP = "-";

/**
 * The import sheet (tools.md, doc 14, flow 9 05–09), over the list it imports into: what the upload holds, the field each of its keys goes
 * to, what to know before importing, and after it the result with the way back. Busy, it cannot be left.
 */
export function ImportSheet({
	collection,
	labelOf,
	go,
	importing,
}: {
	collection: string;
	/** A collection's name as the admin calls it. */
	labelOf: (collection: string) => string;
	go: (route: Route) => void;
	importing: ReturnType<typeof useImport>;
}) {
	const { t } = useAdmin();
	const undo = useUndo();
	const { state } = importing;
	const busy = state?.step === "importing";

	const run = async () => {
		const refusal = await importing.go();
		if (refusal) toast.error(t(reasonOf(refusal)));
	};

	return (
		<Sheet open={state !== null} onOpenChange={(open) => !open && !busy && importing.close()}>
			{state && (
				<SheetContent>
					<SheetHeader closable={!busy}>
						<SheetTitle of={state.name}>{t("import.title")}</SheetTitle>
					</SheetHeader>
					{state.step === "reading" && (
						<SheetBody>
							<Text tone="subtle">{t("import.reading")}</Text>
						</SheetBody>
					)}
					{state.step === "unreadable" && (
						<SheetBody>
							<Text>{t(state.reason)}</Text>
						</SheetBody>
					)}
					{(state.step === "ready" || state.step === "importing") && (
						<Ready state={state} busy={busy} labelOf={labelOf} onMap={importing.map} />
					)}
					{state.step === "done" && (
						<SheetBody>
							<Stack gap={4}>
								<Text variant="heading">{t("import.done", { count: state.result.imported })}</Text>
								<Text tone="subtle">
									{[
										t("import.allDrafts"),
										state.result.items > 0 ? t("import.newItems", { count: state.result.items }) : "",
										state.pictures > 0 ? t("import.pictures", { count: state.pictures }) : "",
										state.result.skipped > 0 ? t("import.skipped", { count: state.result.skipped }) : "",
									]
										.filter(Boolean)
										.join(" · ")}
								</Text>
							</Stack>
							{state.result.renamed.length > 0 && (
								<FormFieldSet>
									<FormFieldLegend variant="field">
										{t("import.renamed", { count: state.result.renamed.length })}
									</FormFieldLegend>
									<ChangeLines>
										{state.result.renamed.map((entry) => (
											<ChangeLine
												key={entry.id}
												what={
													<TextButton
														variant="underline"
														{...linkTo({ screen: "entry", collection, id: entry.id }, go)}
													>
														{entry.title}
													</TextButton>
												}
												then={
													<Text mono variant="note">
														{entry.from} → {entry.to}
													</Text>
												}
											/>
										))}
									</ChangeLines>
								</FormFieldSet>
							)}
						</SheetBody>
					)}
					<SheetFooter>
						{state.step === "done" ? (
							<>
								<Button
									variant="ghost"
									loading={undo.pending}
									onClick={() => void undo.run(state.activityId).then((undone) => undone && importing.close())}
								>
									{t("activity.undo")}
								</Button>
								<Button onClick={importing.close}>{t("import.toList")}</Button>
							</>
						) : state.step === "importing" || (state.step === "ready" && toImport(state.inspected) > 0) ? (
							<>
								<Button variant="ghost" disabled={busy} onClick={importing.close}>
									{t("ui.cancel")}
								</Button>
								<Button loading={busy} onClick={() => void run()}>
									{state.step === "ready"
										? t("import.go", { count: toImport(state.inspected) })
										: state.sent < state.inspected.pictures.length
											? t("import.sending", { done: state.sent, total: state.inspected.pictures.length })
											: t("import.going")}
								</Button>
							</>
						) : (
							// Nothing to import (unread, unreadable, or every entry is here already): the sheet says why, and only closes.
							<Button variant="ghost" onClick={importing.close}>
								{t("ui.close")}
							</Button>
						)}
					</SheetFooter>
				</SheetContent>
			)}
		</Sheet>
	);
}

type ReadyState = Extract<NonNullable<ReturnType<typeof useImport>["state"]>, { step: "ready" | "importing" }>;

/** How many entries the import would make. */
const toImport = (inspected: ReadyState["inspected"]) => inspected.found - inspected.same - inspected.unfit;

/** The sheet before the import: the summary, the fields, the pictures and what to know. */
function Ready({
	state,
	busy,
	labelOf,
	onMap,
}: {
	state: ReadyState;
	busy: boolean;
	labelOf: (collection: string) => string;
	onMap: (key: string, field: string | null) => void;
}) {
	const { t } = useAdmin();
	const { inspected, mapping } = state;
	const fields = [
		// The two fields every collection has are called what the list and the settings call them.
		...inspected.fields.map((field) => ({
			value: field.name,
			label:
				field.role === "title"
					? t("list.column.title")
					: field.role === "slug"
						? t("settings.field.kind.slug")
						: field.label,
		})),
		{ value: SKIP, label: t("import.skipKey") },
	];
	const notes = [
		inspected.same > 0 ? t("import.same", { count: inspected.same }) : "",
		inspected.unfit > 0 ? t("import.unfit", { count: inspected.unfit }) : "",
		...inspected.emptyRequired.map((each) => t("import.empty", { label: each.label, count: each.entries })),
		inspected.missingPictures > 0 ? t("import.missingPictures", { count: inspected.missingPictures }) : "",
	].filter(Boolean);
	return (
		<SheetBody>
			<Stack gap={4}>
				<Text>{t("import.found", { count: inspected.found })}</Text>
				<Text variant="note" tone="subtle">
					{t("import.rules")}
				</Text>
			</Stack>
			{inspected.keys.length > 0 && (
				<FormFieldSet>
					<FormFieldLegend variant="field">{t("import.map")}</FormFieldLegend>
					<div>
						{inspected.keys.map((key) => {
							const field = mapping[key.key] ?? null;
							return (
								<MapRow
									key={key.key}
									name={key.key}
									example={key.example}
									off={field === null}
									warning={
										field !== null && key.creates > 0 && key.createsIn
											? t("import.creates", { label: labelOf(key.createsIn), count: key.creates })
											: undefined
									}
								>
									<PickOne
										size="sm"
										label={key.key}
										items={fields}
										value={field ?? SKIP}
										disabled={busy}
										onChange={(next) => onMap(key.key, next === SKIP ? null : next)}
									/>
								</MapRow>
							);
						})}
					</div>
				</FormFieldSet>
			)}
			{inspected.pictures.length > 0 && (
				<FormFieldSet>
					<FormFieldLegend variant="field">{t("import.images")}</FormFieldLegend>
					<Text>{t("import.imagesTo", { count: inspected.pictures.length, folder: t("import.folder") })}</Text>
				</FormFieldSet>
			)}
			{(notes.length > 0 || inspected.unknown.length > 0) && (
				<FormFieldSet>
					<FormFieldLegend variant="field">{t("import.notes")}</FormFieldLegend>
					<Stack gap={4}>
						{inspected.unknown.length > 0 && (
							<Text>
								{t("import.unknown")} <Text mono>{inspected.unknown.map((each) => each.name).join(", ")}</Text>
							</Text>
						)}
						{notes.map((note) => (
							<Text key={note}>{note}</Text>
						))}
					</Stack>
				</FormFieldSet>
			)}
		</SheetBody>
	);
}
