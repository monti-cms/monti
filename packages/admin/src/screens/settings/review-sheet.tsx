import { type Answers, type Choice, type FieldDefinition, type SchemaChange, storedFields } from "@monti-cms/core";
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
import { useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { type AddressPlace, addressOfProblem } from "./basics-tab";
import { PickOne } from "./pick-one";
import { at } from "./schema-draft";
import type { SettingsDraft } from "./use-settings-draft";

/** A change or a problem of a collection, as against one of the languages (which names none). */
type CollectionChange = SchemaChange & { collection: string };
export const ofCollection = <T extends { collection?: string }>(item: T): item is T & { collection: string } =>
	item.collection !== undefined;
/**
 * What `schema.plan` answers: what must be fixed first, and each change with its choices (the first is the default). The collections' changes and the
 * languages' are reviewed on one sheet (doc 12, 2026-11-11).
 */
export type Plan = { problems: unknown[]; changes: SchemaChange[] };

/** The person's pick for one change: the radio, and the extra answer a pick may need (the field to move values to, the value to fill). */
type Pick = { radio: string; move?: string; fill?: unknown };

const firstPick = (change: SchemaChange): Pick | null => {
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
	// An option taken out: emptying is the default where it is offered (not on a required field), else the first option that stays.
	if (first.do === "removeOption")
		return first.entries === "empty" ? { radio: "empty" } : { radio: "change", move: first.entries.change };
	return { radio: "confirm" };
};

const answerOf = (change: SchemaChange, pick: Pick): Choice | null => {
	const first = change.choices?.[0];
	if (!first) return null;
	if (first.do === "renameField") return { do: "renameField", values: pick.radio as "move" | "empty" };
	if (first.do === "removeField")
		return { do: "removeField", values: pick.radio === "move" && pick.move ? { move: pick.move } : "clear" };
	if (first.do === "addRequiredField")
		return { do: "addRequiredField", fill: pick.radio === "fill" ? pick.fill : null };
	if (first.do === "removeOption")
		// "Change" with no option picked yet is no answer: the save refuses it by the change's name.
		return pick.radio === "change"
			? pick.move
				? { do: "removeOption", entries: { change: pick.move } }
				: null
			: { do: "removeOption", entries: "empty" };
	// Nothing to choose: the answer is the red button itself.
	return first.do === "removeLocale"
		? { do: "removeLocale", confirm: true }
		: { do: "removeCollection", confirm: true };
};

/** A pick that throws stored values away: the apply pill turns into the red delete-and-apply (change.md). */
const deletes = (change: SchemaChange, pick: Pick | undefined) =>
	change.do === "removeCollection" ||
	change.do === "removeLocale" ||
	(change.do === "removeField" && pick?.radio !== "move") ||
	(change.do === "removeOption" && pick?.radio === "empty") ||
	// A field moved into an option is cleared where another option is chosen: here, and on the live site that follows the same change.
	change.do === "moveField" ||
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
	onOpenAddress,
	onOpenLanguages,
	afterApply,
}: {
	model: SettingsDraft;
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
	/** Goes to a collection's address field in its basics tab (a problem of its public or its preview address). */
	onOpenAddress: (collection: string, place: AddressPlace) => void;
	/** Opens the language tab from a line of what is to fix. */
	onOpenLanguages: () => void;
	/** Where the keyboard's focus goes once an apply made with it has closed the sheet (the open tab's name). */
	afterApply?: () => HTMLElement | null;
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
					onOpenAddress={onOpenAddress}
					onOpenLanguages={onOpenLanguages}
					afterApply={afterApply}
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
	onOpenAddress,
	onOpenLanguages,
	afterApply,
}: {
	model: SettingsDraft;
	plan: Plan;
	conflict: boolean;
	/** Why the last apply was refused (not a conflict): it stays at the top of the review until the next try. */
	refused?: string | null;
	applying: boolean;
	onReload: () => void;
	onClose: () => void;
	onApply: (answers: Answers) => void;
	onOpenField: (collection: string, key: string) => void;
	/** Goes to a collection's address field in its basics tab (a problem of its public or its preview address). */
	onOpenAddress: (collection: string, place: AddressPlace) => void;
	onOpenLanguages: () => void;
	afterApply?: () => HTMLElement | null;
}) {
	const { t } = useAdmin();
	// What must be fixed before the change can be applied: told here, when saving, each line opening its field (flow 4, step 09).
	const problems = model.problems;
	const languageName = (code: string | undefined) => model.locales.find((row) => row.code === code)?.name ?? code ?? "";
	const fixFirst = problems.map((problem) => {
		// A problem of the languages (the source is not in the list): its line opens the language tab, where the row can be put back.
		if (!ofCollection(problem))
			return (
				<ChangeGroup
					key={`languages:${problem.locale}:${problem.code}`}
					kind="drop"
					tag={t("settings.review.toFix")}
					title={languageName(problem.locale) || t("settings.tab.languages")}
					identifier={problem.locale}
				>
					<Inline gap={12} align="baseline">
						<ChangeNote danger>{t(`settings.problem.${problem.code}`)}</ChangeNote>
						<TextButton onClick={onOpenLanguages}>{t("settings.review.open")}</TextButton>
					</Inline>
				</ChangeGroup>
			);
		const key = problem.field
			? model.fields(problem.collection).find((each) => model.fieldName(problem.collection, each) === problem.field)
			: undefined;
		// A problem of an address has its field in the basics tab.
		const address = problem.field ? null : addressOfProblem(problem.code);
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
					) : address ? (
						<TextButton onClick={() => onOpenAddress(problem.collection, address)}>
							{t("settings.review.open")}
						</TextButton>
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
	// By the fields as they are stored: a conditional field is its choice here, and its options' fields are fields (doc 19).
	const definition = (change: CollectionChange): FieldDefinition | undefined =>
		change.field ? storedFields(draftSchema?.collections[change.collection])[change.field] : undefined;
	const keyOf = (collection: string, name: string) =>
		model.fields(collection).find((each) => model.fieldName(collection, each) === name) ?? name;
	/** A choice's label as the draft gives it, else its value. */
	const optionLabel = (collection: string, name: string, option: string) => {
		const key = keyOf(collection, name);
		const drafted = model.draft.value(at.fieldValue(collection, key, "optionLabels")) as
			| Record<string, string>
			| undefined;
		// An option taken out has no label in the draft any more: it is named by the label it was saved with.
		return drafted?.[option] ?? model.data?.adminValues[collection]?.fields?.[key]?.optionLabels?.[option] ?? option;
	};
	const fieldLabel = (collection: string, name: string) => {
		const key = model.fields(collection).find((each) => model.fieldName(collection, each) === name) ?? name;
		return model.fieldLabel(collection, key);
	};
	const unchanged = <ChangeNote>{t("settings.review.dataSame")}</ChangeNote>;
	const danger = plan.changes.some((change) => deletes(change, picks[change.id]));
	// What the sheet is about: the languages when one of them changes, then each collection that does.
	const subjects = [
		...(plan.changes.some((change) => !ofCollection(change)) ? [t("settings.tab.languages")] : []),
		...new Set(plan.changes.filter(ofCollection).map((change) => model.label(change.collection))),
	].join(", ");
	/** A change of the languages (doc 04): one added touches nothing, one taken out takes its translations, a new source gets drafts where it has no entry. */
	const languageBlock = (change: SchemaChange) => {
		const name = languageName(change.locale);
		switch (change.do) {
			case "addLocale":
				return (
					<ChangeGroup key={change.id} kind="new" tag={t("changes.new")} title={name} identifier={change.locale}>
						{unchanged}
					</ChangeGroup>
				);
			case "removeLocale":
				return (
					<ChangeGroup key={change.id} kind="drop" tag={t("changes.removed")} title={name} identifier={change.locale}>
						<ChangeNote danger>{t("settings.review.localeGoes")}</ChangeNote>
					</ChangeGroup>
				);
			case "changeSource":
				return (
					<ChangeGroup key={change.id} kind="edit" tag={t("changes.source")} title={name} identifier={change.locale}>
						<ChangeLines>
							<ChangeLine what={t("settings.review.before")} then={languageName(change.from)} />
							<ChangeLine what={t("settings.review.after")} then={name} />
						</ChangeLines>
						{change.count ? (
							<ChangeNote>{t("settings.review.sourceDrafts", { count: change.count })}</ChangeNote>
						) : null}
					</ChangeGroup>
				);
			case "changePrefix":
				return (
					<ChangeGroup key={change.id} kind="edit" tag={t("changes.path")} title={t("settings.site.prefix")}>
						<ChangeLines>
							<ChangeLine what={t("settings.review.before")} then={t(`settings.site.prefix.${change.from}`)} />
							<ChangeLine what={t("settings.review.after")} then={t(`settings.site.prefix.${change.to}`)} />
						</ChangeLines>
						<ChangeNote>{t("settings.review.oldAddresses")}</ChangeNote>
					</ChangeGroup>
				);
			default:
				return null;
		}
	};

	const block = (change: SchemaChange) => {
		if (!ofCollection(change)) return languageBlock(change);
		const c = change.collection;
		const current = picks[change.id];
		// How many entries, and how many of them are on the site now: their published version changes with the draft (doc 02).
		const count = (n: number | undefined, published = change.published) =>
			n === undefined
				? undefined
				: published
					? `${t("settings.review.count", { count: n })} · ${t("settings.review.published", { count: published })}`
					: t("settings.review.count", { count: n });
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
			case "moveField": {
				const field = change.field as string;
				const under = definition(change) as
					| (FieldDefinition & { under?: { field: string; option: string } })
					| undefined;
				const host = under?.under?.field ?? "";
				return (
					<ChangeGroup
						key={change.id}
						kind="edit"
						tag={t("changes.changed")}
						title={fieldLabel(c, field)}
						identifier={`${field} → ${host} · ${change.option}`}
					>
						<ChangeLines>
							<ChangeLine
								what={t("settings.review.movedTo")}
								then={`${fieldLabel(c, host)} · ${optionLabel(c, host, change.option ?? "")}`}
							/>
							<ChangeLine what={t("settings.review.lose")} then={count(change.count) ?? ""} />
						</ChangeLines>
						<ChangeNote danger>{t("settings.review.othersLose")}</ChangeNote>
					</ChangeGroup>
				);
			}
			case "renameOption": {
				const field = change.field as string;
				return (
					<ChangeGroup
						key={change.id}
						kind="edit"
						tag={t("changes.renamed")}
						title={`${fieldLabel(c, field)} · ${optionLabel(c, field, change.option ?? "")}`}
						identifier={`${field} · ${change.from} → ${change.option}`}
					>
						<ChangeLines>
							<ChangeLine what={t("settings.review.chose")} then={count(change.count) ?? ""} />
						</ChangeLines>
					</ChangeGroup>
				);
			}
			case "removeOption": {
				const field = change.field as string;
				const option = change.option ?? "";
				const stay = (change.choices ?? []).flatMap((choice) =>
					choice.do === "removeOption" && typeof choice.entries === "object" ? [choice.entries.change] : [],
				);
				const canEmpty = (change.choices ?? []).some(
					(choice) => choice.do === "removeOption" && choice.entries === "empty",
				);
				// A conditional field's entries changed to an option whose fields are required hold none of them yet: said here, asked for at
				// each entry's next publish (doc 19).
				const host = draftSchema?.collections[c]?.fields[field];
				const target = current?.radio === "change" ? current.move : undefined;
				const asks =
					host?.kind === "conditional" && target
						? Object.values(host.fields[target] ?? {}).some((each) => each.required)
						: false;
				return (
					<ChangeGroup
						key={change.id}
						kind="drop"
						tag={t("changes.removed")}
						title={`${fieldLabel(c, field)} · ${optionLabel(c, field, option)}`}
						identifier={`${field} · ${option}`}
					>
						<ChangeLines>
							<ChangeLine what={t("settings.review.chose")} then={count(change.count) ?? ""} />
						</ChangeLines>
						<RadioGroup
							height="md"
							aria-label={t("settings.review.entriesOf", { name: option })}
							value={current?.radio}
							onValueChange={(radio) => pick(change.id, { radio: String(radio) })}
						>
							<RadioItem
								value="change"
								label={t("settings.review.changeEntries")}
								control={
									<PickOne
										width="fit"
										size="md"
										label={t("settings.review.changeEntries")}
										items={stay.map((each) => ({ value: each, label: optionLabel(c, field, each) }))}
										value={current?.radio === "change" ? (current.move ?? null) : null}
										placeholder={t("settings.review.option")}
										onChange={(move) => pick(change.id, { radio: "change", move })}
									/>
								}
							/>
							{canEmpty ? <RadioItem value="empty" label={t("settings.review.emptyEntries")} /> : null}
						</RadioGroup>
						{current?.radio === "empty" ? <ChangeNote danger>{t("settings.review.valuesGo")}</ChangeNote> : null}
						{asks && target ? (
							<ChangeNote>
								{[
									t("settings.review.requiredEmpty", { option: optionLabel(c, field, target) }),
									...(change.published ? [t("settings.review.published", { count: change.published })] : []),
								].join(" · ")}
							</ChangeNote>
						) : null}
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
							<RadioItem
								value="fill"
								label={t("settings.review.fill", { count: change.count ?? 0 })}
								hint={change.published ? t("settings.review.published", { count: change.published }) : undefined}
								control={fill}
							/>
							<RadioItem value="leave" label={t("settings.review.leave")} />
						</RadioGroup>
						{current?.radio === "leave" ? <ChangeNote>{t("settings.review.leaveNote")}</ChangeNote> : null}
					</ChangeGroup>
				);
			}
		}
	};

	/** Whether the apply was pressed with a key. */
	const byKeys = useRef(false);
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
		// Applied from the keyboard, the sheet goes with the save group that opened it: the focus goes where that group's would, not to the page.
		// Closed any other way, or applied with a pointer (which holds no focus), it is the sheet's own to give back.
		<SheetContent finalFocus={() => (byKeys.current ? (afterApply?.() ?? true) : true)}>
			<SheetHeader closable={!applying}>
				<SheetTitle
					of={`· ${subjects} · ${t("settings.review.changes", { count: plan.changes.length })}`}
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
					{/* The languages first, then the collections: the order the sheet's title names them in. */}
					{[...plan.changes.filter((change) => !ofCollection(change)), ...plan.changes.filter(ofCollection)].map(block)}
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
					<Button
						variant={danger ? "danger" : "primary"}
						loading={applying}
						onClick={(event) => {
							// A press made by a key carries no pointer's count.
							byKeys.current = event.detail === 0;
							apply();
						}}
					>
						{danger ? t("settings.review.applyDelete") : t("settings.review.apply")}
					</Button>
				)}
			</SheetFooter>
		</SheetContent>
	);
}
