import {
	type ConditionalField,
	type FieldDefinition,
	type FieldMark,
	inOptionOrder,
	localeModeOf,
	notChosenFields,
	publicPath,
	slugify,
	storedFields,
} from "@monti-cms/core";
import {
	FormField,
	FormFieldLabel,
	FormFieldWas,
	IconButton,
	Inline,
	PropertyGroup,
	PropertyPanel,
	Text,
} from "@monti-cms/ui";
import { Renew } from "@monti-cms/ui/icons";
import { useRef, useState } from "react";
import { FillAction, FillFailed } from "../../assistant/fill-action";
import { type Fills, isUndoKey } from "../../assistant/use-fill";
import { ALT_MAX } from "../../editor/alt-fields";
import { fieldName } from "../../format/names";
import type { FieldUploads } from "../../media/use-field-uploads";
import { useAdmin } from "../../operations/admin-context";
import type { EntryView } from "../../plugins";
import { type Layout, type SchemaRead, shownLayout } from "../settings/schema-draft";
import { FieldInput, FieldToggle, standsAsSwitch } from "./field-input";
import { MediaField, SharedMediaValue } from "./media-field";
import { PropertyRow } from "./property-row";
import { FieldChange } from "./translation";
import type { EntryEditorModel, EntryRead } from "./use-entry-editor";
import { useRelationField } from "./use-relation-field";

/** Whether a field holds something: an empty text or an empty list is no value. */
const hasValue = (value: unknown) =>
	value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

/** The id of a field's input: a to-do row puts the cursor there. */
export const fieldInputId = (field: string) => `monti-entry-${field}`;

/** The kinds of field the panel holds. */
const SHOWN = new Set<FieldDefinition["kind"]>(["text", "slug", "select", "relation", "media", "conditional"]);

/** The fields the plugins add to a collection, each in its plugin's tab: the collection's own layout does not place them. */
const pluginFieldsOf = (schema: SchemaRead | null, collection: string) =>
	new Map(
		(schema?.pluginTabs?.[collection] ?? []).flatMap((tab) => tab.fields.map((field) => [field.name, field] as const)),
	);

/**
 * The fields of a collection its own tabs show, in the schema's order. The title is the editor's heading, not a property (flow 1), and a
 * plugin's fields stand in the plugin's tab.
 */
export function panelFields(schema: SchemaRead | null, collection: string) {
	const fields = schema?.schema.collections[collection]?.fields ?? {};
	const theirs = pluginFieldsOf(schema, collection);
	return Object.entries(fields)
		.filter(([key, def]) => key !== "title" && SHOWN.has(def.kind) && !theirs.has(key))
		.map(([key]) => key);
}

/**
 * The tabs of the panel: the collection's layout (doc 01), the fields it leaves out in its first tab, and after them each plugin's tab with
 * the plugin's fields in the plugin's order (doc 14).
 */
export function panelLayout(schema: SchemaRead | null, collection: string, defaultTab: string): Layout {
	const layout = schema?.adminValues[collection]?.layout as Layout | undefined;
	return [
		...shownLayout(layout, panelFields(schema, collection), defaultTab),
		...(schema?.pluginTabs?.[collection] ?? []).map((tab) => ({
			tab: tab.tab,
			fields: tab.fields.map((each) => each.name),
		})),
	].filter((tab) => tab.fields.length > 0);
}

/** Where a field's value is in the editor's draft: the address is the entry's own, the rest are its values. */
export const fieldPath = (field: string) => (field === "slug" ? "slug" : `values.${field}`);

/** A tab's entries as the panel groups them: loose fields between groups run together, each group under its name. */
function runs(entries: Layout[number]["fields"]) {
	const out: { key: string; title?: string; fields: string[] }[] = [];
	for (const entry of entries) {
		if (typeof entry !== "string") out.push({ key: `group:${entry.group}`, title: entry.group, fields: entry.fields });
		else {
			const last = out.at(-1);
			if (last && last.title === undefined) last.fields.push(entry);
			else out.push({ key: `run:${entry}`, fields: [entry] });
		}
	}
	return out;
}

/** What a pick shows as: its option's name, a comma between several. */
function pickNames(value: unknown, labels: Record<string, string> = {}) {
	return (Array.isArray(value) ? value : value === undefined ? [] : [value])
		.map((each) => labels[String(each)] ?? String(each))
		.join(", ");
}

/** In a translation where the field is shared, resolves relation group IDs to titles. */
function SharedRelationValue({
	collection,
	field,
	locale,
	value,
	empty,
}: {
	collection: string;
	field: string;
	locale: string;
	value: unknown;
	empty: string;
}) {
	const rel = useRelationField({ collection, field, locale });
	const raw = Array.isArray(value) ? value : value ? [value] : [];
	const shown = raw
		.map((item) => rel.labelOf(String(item)))
		.filter(Boolean)
		.join(", ");
	return (
		<Text variant="note" tone={shown ? undefined : "faint"}>
			{shown || empty}
		</Text>
	);
}

/**
 * The entry's properties (editor.md, the property panel): the collection's fields in its tabs and groups, each an input from the start. The tab is the screen's,
 * so a to-do row can open the tab its field is in.
 */
export function EntryProperties({
	editor,
	schema,
	collection,
	tab,
	onTab,
	readOnly,
	shared,
	uploads,
	altCard,
	onAltCard,
	changes,
	fills,
	fillEntry,
}: {
	editor: EntryEditorModel;
	schema: SchemaRead | null;
	collection: string;
	tab: number;
	onTab: (tab: number) => void;
	readOnly: boolean;
	/** In a translation, the source's field values: a field that is the same in every language shows the source's, read only (doc 04). */
	shared?: Record<string, unknown> | null;
	/** The files going up for the media fields: the editor's, so they outlive this panel. */
	uploads: FieldUploads;
	/** The media field whose picture settings are open: a to-do row opens them. */
	altCard: string | null;
	onAltCard: (field: string | null) => void;
	/** In a translation: the fields whose source moved on (T111), and confirming one. */
	changes?: { marks: readonly FieldMark[]; onConfirm: (field: string) => void };
	/** The screen's "✦ fill" (doc 10, quick tasks); left out on a site that cannot fill, and no button is drawn. */
	fills?: Fills;
	/** The entry as the screen has it (title, values, the body in plain words): what a fill reads it by. */
	fillEntry?: () => Record<string, unknown>;
}) {
	const { t, inputs, views, siteName } = useAdmin();
	const [focused, setFocused] = useState<string | null>(null);
	// The fields as the screen holds them now: a fill's answer comes after the render that asked, and puts back what is there then, through
	// the screen's latest setter (a save since moved what the draft compares against).
	const editorNow = useRef(editor);
	editorNow.current = editor;
	// Fields filled and then typed in without changing the value (a relation's search): undo there is the typing's, not the fill's.
	const searched = useRef(new Set<string>());
	const top = schema?.schema.collections[collection]?.fields ?? {};
	const theirs = pluginFieldsOf(schema, collection);
	// A conditional field (doc 19) is its choice and, under it, the fields of the chosen option: each is stored as a field of its own.
	const definitions = storedFields(schema?.schema.collections[collection]);
	const values = schema?.adminValues[collection]?.fields ?? {};
	const layout = panelLayout(schema, collection, t("entry.defaultTab"));
	const picked = layout[tab] ?? layout[0];
	const keys = panelFields(schema, collection);
	// A red * only in a panel that also has fields that may stay empty (components/field.md, required fields).
	const marksRequired = keys.some((key) => !definitions[key]?.required);
	// An empty address always blocks publishing (doc 02), whatever the schema says.
	const required = (key: string) => key === "slug" || Boolean(definitions[key]?.required);
	const empty = t("entry.empty");
	const entry = editor.loaded && "entry" in editor.loaded ? editor.loaded.entry : null;
	const currentLocale = entry?.locale;
	const entryGroup = entry?.translationGroup;

	/** The entry as a plugin's input or view reads it: what the editor holds now, the source's value where a field is the source's. */
	const entryView = (): EntryView => {
		const slug = String(editor.value("slug") ?? "");
		const held = Object.fromEntries(
			Object.entries(definitions)
				.filter(([name]) => name !== "title" && name !== "slug")
				.map(([name, definition]) => {
					const own = editor.value(`values.${name}`);
					const mode = localeModeOf(name, definition);
					// In a translation: the source's value where the field is the source's, and where an empty one follows it (doc 04).
					const sources = shared && (mode === "same" || (mode === "fromSource" && !hasValue(own)));
					return [name, sources ? shared[name] : own];
				}),
		);
		// Only the chosen option's values are the entry's (doc 19): what another option still holds until the save drops it is not shown
		// to a plugin as a value.
		const others = notChosenFields(schema?.schema.collections[collection], held);
		return {
			collection,
			locale: currentLocale ?? null,
			title: editor.title,
			slug,
			values: Object.fromEntries(
				Object.entries(held).map(([name, value]) => [name, others.has(name) ? undefined : value]),
			),
			address: schema && slug ? publicPath(schema.schema, collection, slug, currentLocale) : null,
			labels: Object.fromEntries(
				Object.entries(values).flatMap(([name, each]) => (each.label ? [[name, each.label]] : [])),
			),
			siteName,
		};
	};

	const row = (key: string, after?: React.ReactNode) => {
		// A field with no value (doc 14): the view its plugin's browser half brings, under its name when it has one. Without that half
		// there is nothing to draw.
		const view = theirs.get(key)?.view;
		if (view !== undefined) {
			const View = views.get(view);
			if (!View) return null;
			const label = theirs.get(key)?.label;
			return (
				<FormField key={key}>
					{label ? <FormFieldLabel>{label}</FormFieldLabel> : null}
					<View field={key} options={theirs.get(key)?.options ?? {}} entry={entryView()} />
				</FormField>
			);
		}
		const def = definitions[key];
		if (!def) return null;
		const id = fieldInputId(key);
		const path = fieldPath(key);
		// A value the assistant proposed for this field and nobody has taken yet (doc 05; T86): it is in the input, blue, and what the
		// entry holds is struck through under it. Changing it takes the proposal first; "discard" on the label row leaves the field as it is.
		const state = readOnly ? null : editor.draft.cell(path);
		const proposed = state?.kind === "proposed" ? state : null;
		const held = editor.value(path);
		const value = proposed ? proposed.value : held;
		const text = typeof value === "string" ? value : "";
		// "✦ Fill" (doc 10, quick tasks): the quick-task model writes this field's value, which goes in as if typed. A text, an address,
		// a relation. Not while a proposal waits in the field: its label row is the proposal's alone.
		const fillTask =
			def.kind === "text" ? "text" : def.kind === "slug" ? "slug" : def.kind === "relation" ? "relation" : null;
		const fillState = fills && fillTask && !readOnly && !proposed ? fills.of(path) : null;
		// What a fill put in is blue until it is changed, as a proposal's value is (components/proposal.md, filling a field).
		const filledNow =
			fillState !== null &&
			fillState.filled !== undefined &&
			JSON.stringify(fillState.filled) === JSON.stringify(held ?? null);
		const proposal = proposed !== null || filledNow;
		const setField = (at: string, next: unknown) => {
			fills?.forget(at);
			editor.set(at, next);
		};
		const name = fieldName(key, values[key]?.label, t);
		const fillButton =
			fills && fillTask && fillState ? (
				<FillAction
					state={fillState}
					held={hasValue(held)}
					filled={filledNow}
					name={name}
					onStop={() => fills.stop(path)}
					onDiscard={() => fills.discard(path)}
					onFill={() =>
						void fills.run(
							path,
							{
								task: fillTask,
								collection,
								...(fillTask === "slug" ? {} : { field: key }),
								...(currentLocale ? { locale: currentLocale } : {}),
								entry: fillEntry?.() ?? {},
							},
							(answer) => {
								const next =
									"value" in answer
										? answer.value
										: def.kind === "relation" && def.many
											? answer.values
											: (answer.values[0] ?? null);
								// What the field holds the moment before, as it is when the answer comes (not when the button was pressed).
								const before = editorNow.current.value(path);
								editorNow.current.set(path, next);
								searched.current.delete(path);
								return { value: next, before, back: () => editorNow.current.set(path, before ?? null) };
							},
						)
					}
				/>
			) : null;
		const proposedLabel = proposed
			? {
					label: t("ui.proposal"),
					tone: "proposal" as const,
					undoLabel: t("settings.discard"),
					undoName: t("entry.proposal.discard", { field: fieldName(key, values[key]?.label, t) }),
					onUndo: () => void editor.draft.discard(proposed.item.id),
				}
			: undefined;
		// What the field holds now, in words, when words say it: a text, an address, a pick. A file or a related item has no name here.
		const heldWords =
			def.kind === "select"
				? pickNames(held, values[key]?.optionLabels)
				: (def.kind === "text" || def.kind === "slug") && typeof held === "string"
					? held
					: "";
		const was = proposed && heldWords ? <FormFieldWas>{heldWords}</FormFieldWas> : null;
		const count =
			// Not while a proposal waits in the field: its label row holds the proposal's dot and "discard" (screens/editor.md). Not in a
			// field that is only read: nothing is typed there to count.
			def.kind === "text" && def.max !== undefined && focused === key && !proposed && !readOnly ? (
				<Text variant="micro" tone="subtle">
					{t("entry.count", { count: text.length, max: def.max })}
				</Text>
			) : undefined;
		const focus = { onFocus: () => setFocused(key), onBlur: () => setFocused(null) };
		// The field's own input, when the site or a plugin brought one under the name the field gives (doc 14): the input part, and
		// what it says at the end of the label row.
		const brought = def.input ? inputs.get(def.input) : undefined;
		const own = brought === undefined ? null : "Input" in brought ? brought : { Input: brought, Note: undefined };
		const ownProps = () => ({
			id,
			field: key,
			definition: def,
			options: def.inputOptions ?? {},
			value,
			onChange: (next: unknown) => setField(path, next),
			readOnly,
			proposal,
			entry: entryView(),
		});
		// A field that is only read has nothing beside its name that is about writing it: no count of its own, and none a plugin's input
		// brings (the host's rule, so every plugin's field follows it).
		const note = readOnly ? undefined : own?.Note ? <own.Note {...ownProps()} /> : count;
		// Only read, an ordered relation with items is a list, which no label can point at with `htmlFor`: the list is named by the label.
		const listOnly = !own && readOnly && def.kind === "relation" && def.many && def.ordered && hasValue(value);
		const changeMark = changes?.marks.find((mark) => mark.field === key);
		const shownInCard = (shownValue: unknown) =>
			def.kind === "media" ? (
				<SharedMediaValue value={shownValue} empty={empty} withAlt />
			) : (
				pickNames(shownValue, values[key]?.optionLabels)
			);
		const change = changeMark ? (
			<FieldChange
				mark={changeMark}
				shown={def.kind === "text" ? undefined : shownInCard}
				onConfirm={() => changes?.onConfirm(key)}
			/>
		) : undefined;
		// In a translation a field that is the same in every language is the source's: its value, read only (editor.md, a value no one changes here).
		if (shared && localeModeOf(key, def) === "same") {
			const sourceNote = (
				<Text variant="micro" tone="faint">
					{t("translation.sharedField")}
				</Text>
			);
			if (def.kind === "media")
				return (
					<FormField key={key}>
						<FormFieldLabel action={sourceNote}>{fieldName(key, values[key]?.label, t)}</FormFieldLabel>
						<SharedMediaValue value={shared[key]} empty={empty} />
					</FormField>
				);
			if (def.kind === "relation") {
				return (
					<FormField key={key}>
						<FormFieldLabel action={sourceNote}>{fieldName(key, values[key]?.label, t)}</FormFieldLabel>
						<SharedRelationValue
							collection={collection}
							field={key}
							locale={currentLocale ?? ""}
							value={shared[key]}
							empty={empty}
						/>
					</FormField>
				);
			}
			// A choice made by a switch reads as what the switch says: on or off, never the option's word.
			const shown =
				def.kind === "select" && def.control === "toggle"
					? t(shared[key] === def.options[0] ? "entry.toggleOn" : "entry.toggleOff")
					: pickNames(shared[key], values[key]?.optionLabels);
			return (
				<FormField key={key}>
					<FormFieldLabel action={sourceNote}>{fieldName(key, values[key]?.label, t)}</FormFieldLabel>
					<Text variant="note" tone={shown ? undefined : "faint"}>
						{shown || empty}
					</Text>
				</FormField>
			);
		}
		if (def.kind === "media")
			return (
				<MediaField
					key={key}
					id={id}
					field={key}
					uploads={uploads}
					card={altCard === key}
					onCard={(open) => onAltCard(open ? key : null)}
					label={fieldName(key, values[key]?.label, t)}
					required={marksRequired && required(key)}
					accept={def.accept}
					change={change}
					proposed={proposedLabel}
					value={value}
					// A translation's empty field follows the source's (doc 09): what shows is that file, until it has its own.
					source={localeModeOf(key, def) === "fromSource" ? shared?.[key] : undefined}
					// × says what it does, as on any field: what follows (the source's file and the follows-source label) shows at once (2026-11-10, owner).
					following={shared && localeModeOf(key, def) === "fromSource" ? t("translation.followsSource") : undefined}
					readOnly={readOnly}
					onChange={(next) => setField(path, next)}
					fill={
						fills && !readOnly
							? {
									state: fills.of(`alt:${path}`),
									forget: () => fills.forget(`alt:${path}`),
									stop: () => fills.stop(`alt:${path}`),
									discard: () => fills.discard(`alt:${path}`),
									again: () => fills.again(`alt:${path}`),
									run: (file, put) =>
										void fills.run(
											`alt:${path}`,
											{
												task: "alt",
												collection,
												...(currentLocale ? { locale: currentLocale } : {}),
												entry: fillEntry?.() ?? {},
												image: { media: file },
											},
											(answer) => {
												const words = ("value" in answer ? answer.value : "").slice(0, ALT_MAX);
												const done = put(words);
												return done ? { value: words, ...done } : null;
											},
										),
								}
							: undefined
					}
				/>
			);
		// A choice with one option, on or off (doc 19): a switch row. A field that names an input of its own puts that one in the switch's place.
		// A plugin's input for a choice of one option is that choice's switch (seo's "hide from search"), whatever the field says of its control.
		if (standsAsSwitch(def, own !== null && "switch" in own && own.switch === true)) {
			// A plugin's own switch stands in the same place as a built-in one (PP-55).
			const toggle = own ? (
				<own.Input {...ownProps()} />
			) : (
				<FieldToggle
					def={def}
					id={id}
					value={value}
					onChange={(next) => setField(path, next)}
					readOnly={readOnly}
					proposal={proposed !== null}
				/>
			);
			return (
				<PropertyRow
					key={key}
					id={id}
					name={fieldName(key, values[key]?.label, t)}
					toggle={toggle}
					proposed={proposedLabel}
					after={after}
				/>
			);
		}
		const strays =
			def.kind === "select"
				? (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).filter(
						(option): option is string => typeof option === "string" && !def.options.includes(option),
					)
				: [];
		const input = () => {
			// The field's own input (doc 14). A media field keeps its own: it is drawn above, with its window and its picture's words.
			if (own) return <own.Input {...ownProps()} />;
			// The kind's input, the same one the settings' preview draws (field-input.tsx).
			return (
				<FieldInput
					def={def}
					id={id}
					value={value}
					onChange={(next) => setField(path, next)}
					placeholder={empty}
					readOnly={readOnly}
					proposal={proposal}
					optionLabels={values[key]?.optionLabels}
					strays={strays}
					relation={{ collection, field: key, locale: currentLocale, entryGroup }}
					labelledBy={listOnly ? `${id}-label` : undefined}
					slugAction={
						readOnly || editor.title.trim() === "" ? undefined : (
							<IconButton label={t("entry.slugAgain")} onClick={() => setField(path, slugify(editor.title))}>
								<Renew aria-hidden />
							</IconButton>
						)
					}
					textProps={focus}
				/>
			);
		};
		return (
			<PropertyRow
				key={key}
				id={id}
				name={fieldName(key, values[key]?.label, t)}
				required={marksRequired && required(key)}
				label={{
					...(listOnly ? { id: `${id}-label` } : {}),
					changed: proposedLabel,
					// While a proposal waits the row is the proposal's alone: no count, no mark of the source's change beside "discard".
					action: proposedLabel ? undefined : [fillButton, note, change].filter(Boolean).length > 1 ? (
						<Inline gap={8} align="baseline">
							{fillButton}
							{note}
							{change}
						</Inline>
					) : (
						(fillButton ?? change ?? note)
					),
				}}
				field={{
					// Undo in a field a fill wrote takes the fill back as one step, as "Discard" does (AS-30): the browser's own undo knows
					// nothing of a value put in by the screen.
					onKeyDown:
						filledNow && fills
							? (event) => {
									// The field's own input only: keys bubble here from a picker's portal too (its search box has its own undo). Not
									// while a search typed in the field or a word being composed is the input's to undo first.
									if (
										!isUndoKey(event) ||
										event.defaultPrevented ||
										event.nativeEvent.isComposing ||
										searched.current.has(path) ||
										!event.currentTarget.contains(event.target as Node)
									)
										return;
									event.preventDefault();
									fills.discard(path);
								}
							: undefined,
					onInput: filledNow ? () => searched.current.add(path) : undefined,
					onBlur: (event) => {
						if (!event.currentTarget.contains(event.relatedTarget as Node | null)) searched.current.delete(path);
					},
				}}
			>
				{input()}
				{was}
				{fills && fillState ? <FillFailed state={fillState} onRetry={() => fills.again(path)} /> : null}
				{strays.length > 0 ? (
					<Text variant="caption" tone="warning">
						{t("entry.notAnOption", { option: strays.join(", ") })}
					</Text>
				) : null}
				{after}
			</PropertyRow>
		);
	};

	/** Every field under an option, however deep: the fields of its conditional fields' options too. */
	const allUnder = (group: ConditionalField["fields"][string]): string[] =>
		Object.entries(group).flatMap(([name, inner]) => [
			name,
			...(inner.kind === "conditional" ? Object.values(inner.fields).flatMap(allUnder) : []),
		]);
	/**
	 * A field's rows: itself and, for a conditional field, the chosen option's fields directly under the choice. One of those may be a
	 * conditional field too: its chosen option's fields follow it the same way.
	 */
	const rowsOf = (key: string, field: FieldDefinition | undefined): React.ReactNode[] => {
		if (field?.kind !== "conditional") return [row(key)];
		const sameAsSource = shared && localeModeOf(key, field) === "same";
		const chosen = sameAsSource ? shared[key] : editor.value(`values.${key}`);
		// The values the other options still hold are dropped by the save (doc 19): said under the choice until then.
		const left = Object.entries(field.fields)
			.filter(([option]) => option !== chosen)
			.map(([option, group]) => ({
				option,
				count: allUnder(group).filter((inner) => hasValue(editor.value(`values.${inner}`))).length,
			}))
			.filter((each) => each.count > 0);
		const labels = values[key]?.optionLabels ?? {};
		const lost =
			left.length > 0 && !sameAsSource ? (
				<Text variant="caption" tone="warning">
					{/* A switch has one option: what goes is that field's own, named by the field. */}
					{t("entry.clearedOnSave", {
						option:
							field.control === "toggle"
								? fieldName(key, values[key]?.label, t)
								: left.map((each) => labels[each.option] ?? each.option).join(", "),
						count: left.reduce((sum, each) => sum + each.count, 0),
					})}
				</Text>
			) : undefined;
		// A choice the assistant proposed and nobody has taken (decided while building, 2026-11-13): the entry is as it was until it is taken, so
		// the fields under the choice stay those of the option it has now. What taking it would drop is said under the choice, as a
		// changed choice says what the save drops.
		const proposedCell = readOnly || sameAsSource ? null : editor.draft.cell(`values.${key}`);
		const proposedChoice = proposedCell?.kind === "proposed" ? proposedCell.value : undefined;
		const wouldGo =
			proposedChoice !== undefined && proposedChoice !== chosen && typeof chosen === "string"
				? allUnder(field.fields[chosen] ?? {}).filter((inner) => hasValue(editor.value(`values.${inner}`))).length
				: 0;
		const onTake =
			wouldGo > 0 ? (
				<Text variant="caption" tone="warning">
					{t("entry.clearedOnTake", {
						option:
							field.control === "toggle"
								? fieldName(key, values[key]?.label, t)
								: (labels[String(chosen)] ?? String(chosen)),
						count: wouldGo,
					})}
				</Text>
			) : undefined;
		const group = typeof chosen === "string" ? (field.fields[chosen] ?? {}) : {};
		// In the order the conditional field keeps for the option (the fields list's dragging), then the rest as the schema has them.
		const inOrder = inOptionOrder(
			Object.keys(group),
			typeof chosen === "string" ? values[key]?.optionFields?.[chosen] : undefined,
		);
		return [row(key, onTake ?? lost), ...inOrder.flatMap((each) => rowsOf(each, group[each]))];
	};
	const rows = (key: string) => rowsOf(key, top[key]);

	/** The fields a tab can show: its own, and under a conditional field the fields of its options. */
	const tabFields = (each: Layout[number]) =>
		each.fields
			.flatMap((entry) => (typeof entry === "string" ? [entry] : entry.fields))
			.flatMap((key) => {
				const field = top[key];
				return field?.kind === "conditional" ? [key, ...Object.values(field.fields).flatMap(allUnder)] : [key];
			});

	/** The publish to-dos (doc 02): those that point at a field mark its tab. */
	const tasks = (editor.loaded as EntryRead | null)?.tasks;

	if (!picked) return null;
	return (
		<PropertyPanel
			label={t("entry.properties")}
			value={String(layout.indexOf(picked))}
			onValueChange={(next) => onTab(Number(next))}
			tabs={layout.map((each, index) => {
				const fields = each === picked || readOnly ? [] : tabFields(each);
				// Of a tab that is not the open one (screens/editor.md): a field a publish to-do points at gives an orange dot by its name; else a
				// proposal waiting in it, a blue one. What blocks publishing comes first.
				const toFix = (tasks ?? []).some((task) => task.field !== undefined && fields.includes(task.field));
				const proposed = fields.some((field) => editor.draft.cell(fieldPath(field)).kind === "proposed");
				return {
					value: String(index),
					label: each.tab,
					...(toFix
						? { dot: "warning" as const, dotLabel: t("entry.todo.tab") }
						: proposed
							? { dot: "proposal" as const, dotLabel: t("entry.proposal.tab") }
							: {}),
				};
			})}
		>
			{runs(picked.fields).map((run) => (
				<PropertyGroup key={run.key} title={run.title}>
					{run.fields.flatMap(rows)}
				</PropertyGroup>
			))}
		</PropertyPanel>
	);
}
