import type { Answers, Choice, FieldDefinition, SchemaChange } from "@monti-cms/core";
import {
	Box,
	Button,
	ChangeGroup,
	ChangeLine,
	ChangeLines,
	ChangeNote,
	ErrorNote,
	Inline,
	Input,
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
import { useAdmin } from "../../operations/admin-context";
import { PickOne } from "./pick-one";
import { at } from "./schema-draft";
import type { CollectionsDraft } from "./use-collections-draft";

/** What `schema.plan` answers: what must be fixed first, and each change with its choices (the first is the default). */
/** A change of a collection. The languages' changes are the language tab's (doc 04), never in this review. */
export type CollectionChange = SchemaChange & { collection: string };
export const ofCollection = <T extends { collection?: string }>(item: T): item is T & { collection: string } =>
	item.collection !== undefined;
export type Plan = { problems: unknown[]; changes: CollectionChange[] };

/** The person's pick for one change: the radio, and the extra answer a pick may need (the field to move values to, the value to fill). */
type Pick = { radio: string; move?: string; fill?: unknown };

const firstPick = (change: CollectionChange): Pick | null => {
	const first = change.choices?.[0];
	if (!first) return null;
	if (first.do === "renameField") return { radio: first.values };
	if (first.do === "removeField") {
		const moves = (change.choices ?? []).flatMap((choice) =>
			choice.do === "removeField" && typeof choice.values === "object" ? [choice.values.move] : [],
		);
		return { radio: "clear", move: moves[0] };
	}
	if (first.do === "addRequiredField") return { radio: "fill", fill: first.fill };
	return { radio: "confirm" };
};

const answerOf = (change: CollectionChange, pick: Pick): Choice | null => {
	const first = change.choices?.[0];
	if (!first) return null;
	if (first.do === "renameField") return { do: "renameField", values: pick.radio as "move" | "empty" };
	if (first.do === "removeField")
		return { do: "removeField", values: pick.radio === "move" && pick.move ? { move: pick.move } : "clear" };
	if (first.do === "addRequiredField")
		return { do: "addRequiredField", fill: pick.radio === "fill" ? pick.fill : null };
	return { do: "removeCollection", confirm: true };
};

/** A pick that throws stored values away: the apply pill turns into the red delete-and-apply (change.md). */
const deletes = (change: CollectionChange, pick: Pick | undefined) =>
	change.do === "removeCollection" ||
	(change.do === "removeField" && pick?.radio !== "move") ||
	(change.do === "renameField" && pick?.radio === "empty");

/**
 * The review before a structure change is applied (flow 4, steps 05, 11, 12, 14, 17; flow 11, step 19): one block per change of `schema.plan`, with
 * its choices for stored values where it has any. Applying sends the picks as `answers`. When the schema file changed after the screen read it, the sheet
 * says so at the top and cannot apply.
 */
export function ReviewSheet({
	model,
	plan,
	conflict,
	refused,
	applying,
	onReload,
	onClose,
	onApply,
	onOpenField,
}: {
	model: CollectionsDraft;
	plan: Plan | null;
	conflict: boolean;
	/** Why the last apply was refused (not a conflict): it stays at the top of the review until the next try. */
	refused?: string | null;
	applying: boolean;
	onReload: () => void;
	onClose: () => void;
	onApply: (answers: Answers) => void;
	/** Opens a field's sheet from a line of what is to fix. */
	onOpenField: (collection: string, key: string) => void;
}) {
	return (
		<Sheet open={plan !== null} onOpenChange={(next) => !next && !applying && onClose()}>
			{plan ? (
				<Body
					model={model}
					plan={plan}
					conflict={conflict}
					refused={refused}
					applying={applying}
					onReload={onReload}
					onClose={onClose}
					onApply={onApply}
					onOpenField={onOpenField}
				/>
			) : null}
		</Sheet>
	);
}

function Body({
	model,
	plan,
	conflict,
	refused,
	applying,
	onReload,
	onClose,
	onApply,
	onOpenField,
}: {
	model: CollectionsDraft;
	plan: Plan;
	conflict: boolean;
	/** Why the last apply was refused (not a conflict): it stays at the top of the review until the next try. */
	refused?: string | null;
	applying: boolean;
	onReload: () => void;
	onClose: () => void;
	onApply: (answers: Answers) => void;
	onOpenField: (collection: string, key: string) => void;
}) {
	const { t } = useAdmin();
	// What must be fixed before the change can be applied: told here, when saving, each line opening its field (flow 4, step 09).
	const problems = model.problems;
	const fixFirst = problems.map((problem) => {
		const key = problem.field
			? model.fields(problem.collection).find((each) => model.fieldName(problem.collection, each) === problem.field)
			: undefined;
		return (
			<ChangeGroup
				key={`${problem.collection}:${problem.field}:${problem.code}`}
				kind="drop"
				tag={t("settings.review.toFix")}
				title={key ? model.fieldLabel(problem.collection, key) : model.label(problem.collection)}
				identifier={problem.field ?? problem.collection}
			>
				<Inline gap={12} align="baseline">
					<ChangeNote danger>{t(`settings.problem.${problem.code}`)}</ChangeNote>
					{key ? (
						<TextButton onClick={() => onOpenField(problem.collection, key)}>{t("settings.review.open")}</TextButton>
					) : null}
				</Inline>
			</ChangeGroup>
		);
	});
	const [picks, setPicks] = useState<Record<string, Pick>>(() =>
		Object.fromEntries(
			plan.changes.flatMap((change) => {
				const pick = firstPick(change);
				return pick ? [[change.id, pick]] : [];
			}),
		),
	);
	const pick = (id: string, patch: Partial<Pick>) =>
		setPicks((current) => ({ ...current, [id]: { ...(current[id] as Pick), ...patch } }));
	const draftSchema = model.built?.schema;
	const definition = (change: CollectionChange): FieldDefinition | undefined =>
		change.field ? draftSchema?.collections[change.collection]?.fields[change.field] : undefined;
	const keyOf = (collection: string, name: string) =>
		model.fields(collection).find((each) => model.fieldName(collection, each) === name) ?? name;
	/** A choice's label as the draft gives it, else its value. */
	const optionLabel = (collection: string, name: string, option: string) =>
		(
			model.draft.value(at.fieldValue(collection, keyOf(collection, name), "optionLabels")) as
				| Record<string, string>
				| undefined
		)?.[option] ?? option;
	const fieldLabel = (collection: string, name: string) => {
		const key = model.fields(collection).find((each) => model.fieldName(collection, each) === name) ?? name;
		return model.fieldLabel(collection, key);
	};
	const unchanged = <ChangeNote>{t("settings.review.dataSame")}</ChangeNote>;
	const danger = plan.changes.some((change) => deletes(change, picks[change.id]));
	const collections = [...new Set(plan.changes.map((change) => model.label(change.collection)))].join(", ");

	const block = (change: CollectionChange) => {
		const c = change.collection;
		const current = picks[change.id];
		const count = (n: number | undefined) => (n === undefined ? undefined : t("settings.review.count", { count: n }));
		switch (change.do) {
			case "addCollection": {
				const made = draftSchema?.collections[c];
				const fields = Object.keys(made?.fields ?? {});
				// A document's only: an item has no preview page.
				const previewPath = made?.kind === "document" ? made.previewPath : undefined;
				return (
					<ChangeGroup key={change.id} kind="new" tag={t("changes.new")} title={model.label(c)} identifier={c}>
						<ChangeLines>
							{draftSchema?.collections[c]?.path && (
								<ChangeLine what={t("settings.basics.path")} then={draftSchema.collections[c].path} />
							)}
							{previewPath && <ChangeLine what={t("settings.basics.previewPath")} then={previewPath} />}
							<ChangeLine what={t("settings.review.fields")} then={fields.join(", ")} />
						</ChangeLines>
						{unchanged}
					</ChangeGroup>
				);
			}
			case "removeCollection":
				return (
					<ChangeGroup key={change.id} kind="drop" tag={t("changes.removed")} title={model.label(c)} identifier={c}>
						<ChangeNote danger>{t("settings.review.collectionGoes")}</ChangeNote>
					</ChangeGroup>
				);
			case "changePath":
				return (
					<ChangeGroup
						key={change.id}
						kind="edit"
						tag={t("changes.path")}
						title={`${model.label(c)} · ${t("settings.basics.path")}`}
						identifier={c}
					>
						<ChangeLines>
							<ChangeLine what={t("settings.review.before")} then={change.from ?? ""} />
							<ChangeLine what={t("settings.review.after")} then={change.to ?? ""} />
						</ChangeLines>
						{change.from && <ChangeNote>{t("settings.review.oldAddresses")}</ChangeNote>}
					</ChangeGroup>
				);
			case "changePreviewPath":
				return (
					<ChangeGroup
						key={change.id}
						kind="edit"
						tag={t("changes.changed")}
						title={`${model.label(c)} · ${t("settings.basics.previewPath")}`}
						identifier={c}
					>
						<ChangeLines>
							<ChangeLine
								what={t("settings.review.before")}
								then={change.from ?? t("settings.basics.previewAtPublic")}
							/>
							<ChangeLine what={t("settings.review.after")} then={change.to ?? t("settings.basics.previewAtPublic")} />
						</ChangeLines>
						<ChangeNote>{t("settings.review.dataSame")}</ChangeNote>
					</ChangeGroup>
				);
			case "renameField":
				return (
					<ChangeGroup
						key={change.id}
						kind="edit"
						tag={t("changes.renamed")}
						title={fieldLabel(c, change.field as string)}
						identifier={`${change.from} → ${change.field}`}
					>
						<RadioGroup
							height="md"
							aria-label={t("settings.review.valuesOf", { name: change.from ?? "" })}
							value={current?.radio}
							onValueChange={(radio) => pick(change.id, { radio: String(radio) })}
						>
							<RadioItem value="move" label={t("settings.review.moveValues")} hint={count(change.count)} />
							<RadioItem value="empty" label={t("settings.review.startEmpty")} />
						</RadioGroup>
						{current?.radio === "empty" ? <ChangeNote danger>{t("settings.review.valuesGo")}</ChangeNote> : null}
					</ChangeGroup>
				);
			case "removeField": {
				const moves = (change.choices ?? []).flatMap((choice) =>
					choice.do === "removeField" && typeof choice.values === "object" ? [choice.values.move] : [],
				);
				return (
					<ChangeGroup
						key={change.id}
						kind="drop"
						tag={t("changes.removed")}
						title={fieldLabel(c, change.field as string)}
						identifier={change.field}
					>
						<RadioGroup
							height="md"
							aria-label={t("settings.review.valuesOf", { name: change.field ?? "" })}
							value={current?.radio}
							onValueChange={(radio) => pick(change.id, { radio: String(radio) })}
						>
							{/* The choice that keeps the values comes first, as in a rename and a new required field; the default stays clearing (doc 01). */}
							{moves.length > 0 ? (
								<RadioItem
									value="move"
									label={t("settings.review.moveTo")}
									control={
										<PickOne
											width="fit"
											size="md"
											label={t("settings.review.moveTo")}
											items={moves.map((move) => ({ value: move, label: fieldLabel(c, move) }))}
											value={current?.radio === "move" ? (current.move ?? null) : null}
											placeholder={t("settings.review.field")}
											onChange={(move) => pick(change.id, { radio: "move", move })}
										/>
									}
								/>
							) : null}
							<RadioItem value="clear" label={t("settings.review.clearValues")} hint={count(change.count)} />
						</RadioGroup>
						{current?.radio !== "move" ? <ChangeNote danger>{t("settings.review.valuesGo")}</ChangeNote> : null}
					</ChangeGroup>
				);
			}
			case "addField":
			case "changeField": {
				const def = definition(change);
				const name = fieldLabel(c, change.field as string);
				const identifier = `${change.field} · ${def?.kind ?? ""}`;
				if (!change.choices)
					return (
						<ChangeGroup
							key={change.id}
							kind={change.do === "addField" ? "new" : "edit"}
							tag={change.do === "addField" ? t("changes.new") : t("changes.changed")}
							title={name}
							identifier={identifier}
						>
							{unchanged}
						</ChangeGroup>
					);
				const fill =
					def?.kind === "select" ? (
						<PickOne
							width="fit"
							size="md"
							label={t("settings.review.fillWith")}
							items={def.options.map((option) => ({
								value: option,
								label: optionLabel(c, change.field as string, option),
							}))}
							value={String((Array.isArray(current?.fill) ? current?.fill[0] : current?.fill) ?? "")}
							onChange={(value) => pick(change.id, { radio: "fill", fill: def.many ? [value] : value })}
						/>
					) : (
						<Input
							size="md"
							width="short"
							aria-label={t("settings.review.fillWith")}
							value={String(current?.fill ?? "")}
							onChange={(event) => pick(change.id, { radio: "fill", fill: event.target.value })}
						/>
					);
				return (
					<ChangeGroup key={change.id} kind="new" tag={t("changes.required")} title={name} identifier={identifier}>
						<RadioGroup
							height="md"
							aria-label={t("settings.review.emptyOf", { name: change.field ?? "" })}
							value={current?.radio}
							onValueChange={(radio) => pick(change.id, { radio: String(radio) })}
						>
							<RadioItem value="fill" label={t("settings.review.fill", { count: change.count ?? 0 })} control={fill} />
							<RadioItem value="leave" label={t("settings.review.leave")} />
						</RadioGroup>
						{current?.radio === "leave" ? <ChangeNote>{t("settings.review.leaveNote")}</ChangeNote> : null}
					</ChangeGroup>
				);
			}
		}
	};

	const apply = () => {
		const answers: Answers = {};
		for (const change of plan.changes) {
			const chosen = picks[change.id];
			const answer = chosen ? answerOf(change, chosen) : null;
			if (answer) answers[change.id] = answer;
		}
		onApply(answers);
	};

	return (
		<SheetContent>
			<SheetHeader closable={!applying}>
				<SheetTitle
					of={`· ${collections} · ${t("settings.review.changes", { count: plan.changes.length })}`}
					ofMono={false}
				>
					{t("settings.review.title")}
				</SheetTitle>
			</SheetHeader>
			<SheetBody>
				{/* One run: the first block starts at the body's top; under the note, a block keeps its own 16px above, 12px more from the note. */}
				<Stack gap={0}>
					{conflict ? (
						<Box paddingBottom={12}>
							<ErrorNote title={t("settings.review.fileChanged")}>{t("settings.review.fileChangedLine")}</ErrorNote>
						</Box>
					) : null}
					{refused && !conflict ? (
						<Box paddingBottom={12}>
							<ErrorNote title={refused} />
						</Box>
					) : null}
					{fixFirst}
					{plan.changes.map(block)}
				</Stack>
			</SheetBody>
			<SheetFooter>
				<Button variant="ghost" disabled={applying} onClick={onClose}>
					{t("settings.cancel")}
				</Button>
				{/* With the file changed under the screen, reading it again is the one thing left to do: it takes the pill's place. */}
				{/* While something is to fix there is nothing to apply: no pill. */}
				{problems.length > 0 ? null : conflict ? (
					<Button onClick={onReload}>{t("settings.reload")}</Button>
				) : (
					<Button variant={danger ? "danger" : "primary"} loading={applying} onClick={apply}>
						{danger ? t("settings.review.applyDelete") : t("settings.review.apply")}
					</Button>
				)}
			</SheetFooter>
		</SheetContent>
	);
}
