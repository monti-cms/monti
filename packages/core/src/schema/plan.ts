import { type Kysely, sql, type Transaction } from "kysely";
import { fingerprint } from "../bytes";
import type { Database } from "../db/schema";
import { canonical, sameJson } from "../json";
import {
	type CollectionDefinition,
	type FieldDefinition,
	type LocalesDefinition,
	type OptionPlace,
	placesOf,
	type Schema,
	type StoredField,
	storedFields,
} from "./define";
import type { ChangeStep } from "./files";

type Db = Kysely<Database> | Transaction<Database>;

/**
 * A field the admin renamed (the server cannot tell a rename from a remove and an add, so the draft says so). With `of` it is an option of that
 * field (by the field's name now) that was renamed: the stored word is rewritten, in a plain select and in a conditional field alike.
 */
export type Rename = { collection: string; from: string; to: string; of?: string };

/** What a person chooses for a change that touches stored values (doc 01, the review table). The first option is the default. */
export type Choice =
	| { do: "renameField"; values: "move" | "empty" }
	| { do: "removeField"; values: "clear" | { move: string } }
	| { do: "addRequiredField"; fill: unknown | null }
	/** An option taken out of a conditional field (doc 19): the entries that chose it are left with no choice, or given another option. */
	| { do: "removeOption"; entries: "empty" | { change: string } }
	| { do: "removeCollection"; confirm: true }
	| { do: "removeLocale"; confirm: true };

export type SchemaChange = {
	/** Stable within a plan: the review answers a change by this id. */
	id: string;
	do:
		| "addCollection"
		| "removeCollection"
		| "changePath"
		| "changePreviewPath"
		| "addField"
		| "removeField"
		| "renameField"
		| "changeField"
		| "removeOption"
		| "renameOption"
		| "moveField"
		| "addLocale"
		| "removeLocale"
		| "changeSource"
		| "changePrefix";
	/** Absent for a change of the languages (doc 04). */
	collection?: string;
	field?: string;
	/**
	 * For an option taken out of a field, the option; for a renamed one, its new word (`from` is the old one); for a field moved into a
	 * conditional field's option, that option (the entries that chose another lose the field's value).
	 */
	option?: string;
	/** The language added or removed, or the new source language. */
	locale?: string;
	/**
	 * For a rename, the old name; for a path change, the old path; for a change of how addresses show the language, the old way. A preview path put
	 * in has no `from`, one taken out no `to`.
	 */
	from?: string;
	to?: string;
	/**
	 * For a field change, how many entries it touches in this database: with values, or empty. On the dev server this is the dev data; the live site
	 * may have more, so a count never decides whether the review asks. Path changes and removed collections show none (doc 01).
	 */
	count?: number;
	/** Of those entries, how many are on the site now: their published version is changed with the draft (doc 02). Trashed ones are not counted. */
	published?: number;
	/**
	 * For a removed field, by each field of a conditional field's option its values can be moved to: how many of the counted entries keep the
	 * value there. Those are the entries that have that option chosen when the move runs, which the answers to the options taken out in the
	 * same change decide (`planSchema`'s `answers`); the rest lose the value, as they would lose any value of an option that is not theirs.
	 */
	kept?: Record<string, number>;
	/** What the review asks, with the default first. Absent when the change touches no stored value. */
	choices?: Choice[];
};

const previewPathOf = (collection: CollectionDefinition) =>
	collection.kind === "document" ? collection.previewPath : undefined;

/** The same hash for the same schema, whatever the key order. */
export function schemaHash(schema: Schema): string {
	return fingerprint(JSON.stringify(canonical(schema)));
}

/** Entries of a collection whose value for `field` is not empty. Trashed entries count: their values come back with them. */
const hasValue = (field: string) => sql<boolean>`coalesce(values->>${field}, '') <> ''`;

async function countEntries(db: Db, collection: string, where: Where) {
	const row = await db
		.selectFrom("entries")
		.select((eb) => eb.fn.countAll<string>().as("all"))
		.where("collection", "=", collection)
		.where(whereOf(where, "entries"))
		.executeTakeFirstOrThrow();
	return Number(row.all);
}

/** The count of a data change: the entries it touches, and how many of them are on the site now, by their published version's values. */
async function counts(db: Db, collection: string, where: Where) {
	const row = await db
		.selectFrom("entry_published")
		.select((eb) => eb.fn.countAll<string>().as("all"))
		.where("collection", "=", collection)
		.where(whereOf(where, "entry_published"))
		.where("entry_id", "in", (eb) =>
			eb.selectFrom("entries").select("id").where("status", "=", "published").where("trashed_at", "is", null),
		)
		.executeTakeFirstOrThrow();
	return { count: await countEntries(db, collection, where), published: Number(row.all) };
}

/** The table a condition is asked of: an entry's working copy, or what the site shows of it. */
export type Copies = "entries" | "entry_published";

/**
 * The choice a copy of an entry goes by for a conditional field (doc 19). The group's entry in the source language holds the choice: its
 * own copy goes by its own values. A translation never stores the choice: it goes by its source as it follows it, which is what the site
 * shows of the source while it is there and its working copy until then (the same rule as `followedFields`). A group with no entry in
 * the source language has nothing to follow, and its entries go by what they hold themselves.
 */
const choiceOf = (table: Copies, field: string, source: string) => {
	const [own, id] =
		table === "entries"
			? [sql`entries.values`, sql`entries.id`]
			: [sql`entry_published.values`, sql`entry_published.entry_id`];
	return sql`coalesce((
		select coalesce(shown.values, origin.values)->>${field} from entries me
		join entries origin on origin.translation_group = me.translation_group and origin.locale = ${source} and origin.id <> me.id
		left join entry_published shown on shown.entry_id = origin.id
		where me.id = ${id} and me.locale <> ${source}
		order by origin.trashed_at is not null, origin.created_at, origin.id limit 1), ${own}->>${field})`;
};

/**
 * Entries for which a field of a conditional field's option is theirs: those that chose that option, and every option above it (a
 * translation by its source's choice; `source` is the source language as the database has it then). Any entry, for a field on its own.
 */
export const theirs = (under: StoredField["under"], source: string) => (table: Copies) =>
	under
		? sql<boolean>`(${sql.join(
				placesOf(under).map((place) => sql`coalesce(${choiceOf(table, place.field, source)} = ${place.option}, false)`),
				sql` and `,
			)})`
		: sql<boolean>`true`;

/** A condition on a copy of an entry: the same for both copies, or one that reads the copy's own table (`theirs`). */
export type Where = ReturnType<typeof sql<boolean>> | ((table: Copies) => ReturnType<typeof sql<boolean>>);
export const whereOf = (where: Where, table: Copies) => (typeof where === "function" ? where(table) : where);

/** Entries that have this option of a select chosen: the one value of a single select, or one of a many's. */
export const hasOption = (field: string, option: string) =>
	sql<boolean>`(values->>${field} = ${option} or (jsonb_typeof(values->${field}) = 'array' and values->${field} ? ${option}))`;

/**
 * What saving `draft` over `current` changes, with the entries each change touches and what the review must ask. Nothing is written. The review asks
 * about every change that can touch stored values on the live site, even when this (dev) database has none (doc 01, principle 4).
 */
export async function planSchema(
	db: Db,
	current: Schema,
	draft: Schema,
	renames: Rename[] = [],
	/** The review's answers so far: they decide who has an option chosen when a removed field's values are moved into it (`kept`). */
	answers: Answers = {},
): Promise<SchemaChange[]> {
	const changes: SchemaChange[] = [];
	for (const [name, collection] of Object.entries(draft.collections)) {
		const before = current.collections[name];
		if (!before) {
			changes.push({ id: `addCollection:${name}`, do: "addCollection", collection: name });
			continue;
		}
		if (before.path !== collection.path)
			changes.push({
				id: `changePath:${name}`,
				do: "changePath",
				collection: name,
				from: before.path,
				to: collection.path,
			});
		// The preview page's address (doc 16): put in, changed or taken out. It touches no stored value and no public address.
		const [previewBefore, previewAfter] = [previewPathOf(before), previewPathOf(collection)];
		if (previewBefore !== previewAfter)
			changes.push({
				id: `changePreviewPath:${name}`,
				do: "changePreviewPath",
				collection: name,
				...(previewBefore === undefined ? {} : { from: previewBefore }),
				...(previewAfter === undefined ? {} : { to: previewAfter }),
			});
		changes.push(...(await planFields(db, name, before, collection, renames, answers, current.locales.source)));
	}
	for (const name of Object.keys(current.collections))
		if (!draft.collections[name])
			// Nothing to choose: the answer is the red "delete and apply" button itself.
			changes.push({
				id: `removeCollection:${name}`,
				do: "removeCollection",
				collection: name,
				choices: [{ do: "removeCollection", confirm: true }],
			});
	changes.push(...(await planLocales(db, current.locales, draft.locales)));
	return changes;
}

/**
 * The language changes (doc 04): an added language touches nothing; a removed one deletes its translations, so the review asks for the red "delete
 * and apply" even when this database has none; a new source language makes a draft in each group without an entry in it (counted here).
 */
async function planLocales(db: Db, before: LocalesDefinition, after: LocalesDefinition): Promise<SchemaChange[]> {
	const changes: SchemaChange[] = [];
	const had = new Set(before.list.map((locale) => locale.code));
	const has = new Set(after.list.map((locale) => locale.code));
	for (const code of has) if (!had.has(code)) changes.push({ id: `addLocale:${code}`, do: "addLocale", locale: code });
	for (const code of had)
		if (!has.has(code)) {
			const row = await db
				.selectFrom("entries")
				.select((eb) => eb.fn.countAll<string>().as("all"))
				.where("locale", "=", code)
				.executeTakeFirstOrThrow();
			changes.push({
				id: `removeLocale:${code}`,
				do: "removeLocale",
				locale: code,
				count: Number(row.all),
				choices: [{ do: "removeLocale", confirm: true }],
			});
		}
	if (before.source !== after.source) {
		const { rows } = await sql<{ all: string }>`select count(distinct translation_group) as all from entries g
			where g.trashed_at is null and not exists (select 1 from entries n where n.translation_group = g.translation_group
				and n.locale = ${after.source} and n.trashed_at is null)`.execute(db);
		changes.push({
			id: "changeSource",
			do: "changeSource",
			from: before.source,
			locale: after.source,
			count: Number(rows[0]?.all ?? 0),
		});
	}
	// No stored value changes, but every translation's public address does (doc 12).
	if (before.prefix !== after.prefix)
		changes.push({ id: "changePrefix", do: "changePrefix", from: before.prefix, to: after.prefix });
	return changes;
}

async function planFields(
	db: Db,
	collection: string,
	beforeCollection: CollectionDefinition,
	afterCollection: CollectionDefinition,
	renames: Rename[],
	answers: Answers,
	/** The source language as the database has it now: a translation's choice is read from its entry in it. */
	source: string,
): Promise<SchemaChange[]> {
	// By the fields as they are stored (doc 19): a field moved into a conditional field's group, or from one group to another, keeps its
	// name and its values; an option taken out takes its group's fields with it, and they are asked about as any removed field is.
	const before = { fields: storedFields(beforeCollection) };
	const after = { fields: storedFields(afterCollection) };
	const changes: SchemaChange[] = [];
	const renamed = renames.filter(
		(rename) => !rename.of && rename.collection === collection && before.fields[rename.from] && after.fields[rename.to],
	);
	const fromName = new Map(renamed.map((rename) => [rename.to, rename.from]));
	/** The options of a field renamed in this change, old word to new: both sides must have them, and the old word must be gone. */
	const optionRenames = (field: string, old: StoredField, now: StoredField) =>
		old.kind !== "select" || now.kind !== "select"
			? []
			: renames.filter(
					(rename) =>
						rename.of === field &&
						rename.collection === collection &&
						old.options.includes(rename.from) &&
						now.options.includes(rename.to) &&
						!now.options.includes(rename.from) &&
						!old.options.includes(rename.to),
				);
	const renamedFrom = new Set(renamed.map((rename) => rename.from));
	const renamedTo = new Set(renamed.map((rename) => rename.to));

	for (const rename of renamed)
		changes.push({
			id: `renameField:${collection}.${rename.from}`,
			do: "renameField",
			collection,
			field: rename.to,
			from: rename.from,
			...(await counts(db, collection, hasValue(rename.from))),
			choices: [
				{ do: "renameField", values: "move" },
				{ do: "renameField", values: "empty" },
			],
		});

	for (const [field, definition] of Object.entries(before.fields)) {
		if (after.fields[field] || renamedFrom.has(field)) continue;
		const movable = Object.entries(after.fields)
			.filter(([other, target]) => other !== "title" && other !== "slug" && target.kind === definition.kind)
			.map(([other]) => other);
		changes.push({
			id: `removeField:${collection}.${field}`,
			do: "removeField",
			collection,
			field,
			...(await counts(db, collection, hasValue(field))),
			choices: [
				{ do: "removeField", values: "clear" },
				...movable.map((target) => ({ do: "removeField" as const, values: { move: target } })),
			],
		});
	}

	for (const [field, definition] of Object.entries(after.fields)) {
		const old = before.fields[field];
		if (renamedTo.has(field)) continue;
		if (!old)
			changes.push(await planNewField(db, collection, field, definition, source, "addField", placeBefore(definition)));
		// A field whose only change is its place in a conditional field has its own line below (it clears values: not "the data is the same").
		else if (
			!(definition.required && !old.required) &&
			movedInto(old, definition) &&
			sameJson({ ...old, under: undefined }, { ...definition, under: undefined })
		)
			continue;
		// A select whose only change is an option renamed or taken out has its own lines below: "changed, the data is the same" would be untrue.
		else if (
			!(definition.required && !old.required) &&
			old.kind === "select" &&
			definition.kind === "select" &&
			optionsTouched(old, definition) &&
			// An option added in the same change keeps the field's own line: nothing below says it.
			definition.options.every(
				(option) => old.options.includes(option) || optionRenames(field, old, definition).some((r) => r.to === option),
			) &&
			sameJson({ ...old, options: [] }, { ...definition, options: [] })
		)
			continue;
		else if (!sameJson(underRenamed(old), definition) || (definition.required && !old.required))
			changes.push(
				definition.required && !old.required
					? await planNewField(db, collection, field, definition, source, "changeField", placeBefore(definition))
					: { id: `changeField:${collection}.${field}`, do: "changeField", collection, field },
			);
	}

	// The options of a select, and of a conditional field's choice, are stored words (doc 19, 2026-11-13): a renamed one is rewritten, and
	// one taken out is asked about. A field renamed in the same change is read under its old name's definition; its steps come after the
	// field's own rename, so they find the values under the new name.
	for (const [field, definition] of Object.entries(after.fields)) {
		const old = before.fields[fromName.get(field) ?? field];
		if (!old) continue;
		// A field moved into a conditional field's option (from on its own, or from another option) is that option's from now on: the
		// entries that chose another option lose its value, in the draft and on the site. Nothing to choose; the review says how many.
		if (definition.under && movedInto(old, definition))
			changes.push({
				id: `moveField:${collection}.${field}`,
				do: "moveField",
				collection,
				field,
				option: definition.under.option,
				...(await counts(db, collection, (table) => {
					const place = definition.under ? underBefore(definition.under) : undefined;
					return sql<boolean>`${hasValue(fromName.get(field) ?? field)} and not ${theirs(place, source)(table)}`;
				})),
			});
		if (old.kind !== "select" || definition.kind !== "select") continue;
		const renamedOptions = optionRenames(field, old, definition);
		for (const rename of renamedOptions)
			changes.push({
				id: `renameOption:${collection}.${field}.${rename.from}`,
				do: "renameOption",
				collection,
				field,
				from: rename.from,
				option: rename.to,
				...(await counts(db, collection, hasOption(fromName.get(field) ?? field, rename.from))),
			});
		const gone = old.options.filter(
			(option) => !definition.options.includes(option) && !renamedOptions.some((rename) => rename.from === option),
		);
		for (const option of gone)
			changes.push({
				id: `removeOption:${collection}.${field}.${option}`,
				do: "removeOption",
				collection,
				field,
				option,
				...(await counts(db, collection, hasOption(fromName.get(field) ?? field, option))),
				// Changing comes first, so it is the default: emptying published values is chosen, not fallen into. A required field is
				// never emptied: a site that trusts "required" would get nothing from an entry that is on it.
				choices: [
					...definition.options.map((to) => ({ do: "removeOption" as const, entries: { change: to } })),
					...(definition.required ? [] : [{ do: "removeOption" as const, entries: "empty" as const }]),
				],
			});
	}
	// A removed field's values moved into a field of an option reach only the entries that have that option by then (doc 19): the steps
	// before the move (a field's rename, an option's rename, an option taken out and its entries changed or emptied) have run, the fills of
	// fields on their own have not. Counted on the database as it is now, by the words that will have become that option.
	for (const change of changes) {
		if (change.do !== "removeField") continue;
		const kept: Record<string, number> = {};
		for (const choice of change.choices ?? []) {
			if (choice.do !== "removeField" || typeof choice.values !== "object") continue;
			const under = after.fields[choice.values.move]?.under;
			if (!under) continue;
			const chosen = placesOf(under).map((place) => {
				const host = fromName.get(place.field) ?? place.field;
				const words = wordsBecoming(place.field, place.option);
				// A conditional field renamed with its values left behind starts empty: nobody has an option of it when the values move.
				const renamedEmpty = ([] as Choice[])
					.concat(answers[`renameField:${collection}.${host}`] ?? [])
					.some((choice) => choice.do === "renameField" && choice.values === "empty");
				return words.length > 0 && before.fields[host] && !(host !== place.field && renamedEmpty)
					? sql<boolean>`coalesce(${choiceOf("entries", host, source)} in (${sql.join(words)}), false)`
					: sql<boolean>`false`;
			});
			kept[choice.values.move] = await countEntries(
				db,
				collection,
				sql<boolean>`${hasValue(String(change.field))} and ${sql.join(chosen, sql` and `)}`,
			);
		}
		if (Object.keys(kept).length > 0) change.kept = kept;
	}
	return changes;

	/**
	 * The words entries hold now for a conditional field's choice that are `option` by the time a removed field's values move: the option
	 * itself where it stays, the word it was renamed from, and each option taken out whose entries are changed to it (by the answer given, or
	 * by the default, which is the first: to change).
	 */
	function wordsBecoming(field: string, option: string): string[] {
		const [old, now] = [before.fields[fromName.get(field) ?? field], after.fields[field]];
		if (!old || !now || old.kind !== "select" || now.kind !== "select") return [];
		const renamedOptions = optionRenames(field, old, now);
		return old.options.filter((word) => {
			const renamedTo = renamedOptions.find((rename) => rename.from === word)?.to;
			if (renamedTo !== undefined) return renamedTo === option;
			if (now.options.includes(word)) return word === option;
			const id = `removeOption:${collection}.${field}.${word}`;
			const given = ([] as Choice[]).concat(answers[id] ?? []).find((choice) => choice.do === "removeOption");
			const entries = given?.do === "removeOption" ? given.entries : { change: now.options[0] };
			return typeof entries === "object" && entries.change === option;
		});
	}

	/** A field's place in a conditional field as the database names it now (`underBefore`); none for a field on its own. */
	function placeBefore(definition: StoredField) {
		return definition.under ? underBefore(definition.under) : undefined;
	}

	/** Whether the field stands in another place of a conditional field than it did: into an option, or from one option to another. */
	function movedInto(old: StoredField, now: StoredField) {
		return now.under !== undefined && !sameJson(underRenamed(old).under, now.under);
	}

	/**
	 * The place a field has after the change, as the entries name it before the change's steps: the conditional field under its old name
	 * and the option under its old word. The count reads the database as it is now.
	 */
	function underBefore(under: OptionPlace): OptionPlace {
		const host = fromName.get(under.field) ?? under.field;
		const [was, now] = [before.fields[host], after.fields[under.field]];
		const word = was && now ? optionRenames(under.field, was, now).find((r) => r.to === under.option)?.from : undefined;
		return { field: host, option: word ?? under.option, ...(under.above ? { above: underBefore(under.above) } : {}) };
	}

	/** Whether an option of the field was renamed or taken out. */
	function optionsTouched(old: StoredField, now: StoredField) {
		if (old.kind !== "select" || now.kind !== "select") return false;
		return old.options.some((option) => !now.options.includes(option));
	}

	/** A field of a conditional field's option as it is after the option's own rename: the group follows its option, which is no change of the field. */
	function underRenamed(old: StoredField): StoredField {
		return old.under ? { ...old, under: placeAfter(old.under) } : old;
	}

	/** A place as the entries name it after the change's renames: the conditional field under its new name, the option under its new word. */
	function placeAfter(under: OptionPlace): OptionPlace {
		const host = renamed.find((rename) => rename.from === under.field)?.to ?? under.field;
		const [was, now] = [before.fields[under.field], after.fields[host]];
		const to =
			was && now ? optionRenames(host, was, now).find((rename) => rename.from === under.option)?.to : undefined;
		return { field: host, option: to ?? under.option, ...(under.above ? { above: placeAfter(under.above) } : {}) };
	}
}

async function planNewField(
	db: Db,
	collection: string,
	field: string,
	definition: FieldDefinition,
	source: string,
	kind: "addField" | "changeField" = "addField",
	/** For a field of a conditional field's option, that place as the database names it now: the field and the option before any rename. */
	place?: StoredField["under"],
): Promise<SchemaChange> {
	const change: SchemaChange = { id: `${kind}:${collection}.${field}`, do: kind, collection, field };
	if (definition.required) {
		// A required field of a conditional field's option is asked of the entries that chose that option only (doc 19): those that have it
		// chosen now. Its fill runs before the same change gives any entry that option (`stepsFor`), so the count is what the fill writes.
		const under = (definition as StoredField).under;
		if (under) change.option = under.option;
		Object.assign(
			change,
			await counts(db, collection, (table) => sql<boolean>`not ${hasValue(field)} and ${theirs(place, source)(table)}`),
		);
		change.choices = [
			{ do: "addRequiredField", fill: defaultFill(definition) },
			{ do: "addRequiredField", fill: null },
		];
	}
	return change;
}

const defaultFill = (definition: FieldDefinition): unknown =>
	definition.kind === "select" ? (definition.many ? [definition.options[0]] : definition.options[0]) : "";

/** A person's answer to a change, by change id. A change with choices and no answer cannot be applied. */
export type Answers = Record<string, Choice | Choice[]>;

/** The data steps of a plan and its answers; the changes still unanswered come back in `missing`. */
export function stepsFor(changes: SchemaChange[], answers: Answers): { steps: ChangeStep[]; missing: string[] } {
	const steps: ChangeStep[] = [];
	/** The fills of fields of an option: they run before the change gives any entry that option. */
	const inner = new Set<ChangeStep>();
	const missing: string[] = [];
	for (const change of changes) {
		if (change.do === "changeSource")
			steps.push({ do: "changeSource", from: String(change.from), to: String(change.locale) });
		// A field moved into an option asks nothing: the entries that did not choose that option lose its value. The step reads the
		// place from the schema it is followed with.
		if (change.do === "moveField")
			steps.push({ do: "keepChosen", collection: change.collection ?? "", field: String(change.field) });
		// A renamed option asks nothing: its word is rewritten wherever it is chosen.
		if (change.do === "renameOption")
			steps.push({
				do: "renameOption",
				collection: change.collection ?? "",
				field: String(change.field),
				from: String(change.from),
				to: String(change.option),
			});
		if (!change.choices) continue;
		const given = ([] as Choice[]).concat(answers[change.id] ?? []);
		const kinds = new Set(change.choices.map((choice) => choice.do));
		const answer = (kind: Choice["do"]) => given.find((choice) => choice.do === kind);
		if ([...kinds].some((kind) => !answer(kind))) {
			missing.push(change.id);
			continue;
		}
		const collection = change.collection ?? "";
		const field = change.field as string;
		for (const choice of given) {
			if (choice.do === "removeLocale") steps.push({ do: "removeLocale", locale: String(change.locale) });
			if (choice.do === "removeCollection") steps.push({ do: "removeCollection", collection });
			if (choice.do === "renameField")
				steps.push({ do: "renameField", collection, from: change.from as string, to: field, values: choice.values });
			if (choice.do === "removeField") steps.push({ do: "removeField", collection, field, values: choice.values });
			if (choice.do === "removeOption")
				steps.push({ do: "removeOption", collection, field, option: String(change.option), entries: choice.entries });
			if (choice.do === "addRequiredField" && choice.fill !== null) {
				const fill: ChangeStep = { do: "fillField", collection, field, value: choice.fill };
				steps.push(fill);
				if (change.option !== undefined) inner.add(fill);
			}
		}
	}
	// A language leaves last. The collections' steps keep their place before the languages' (a renamed or moved field's values are under their
	// new name by the time a new source language is made from the old one, which keeps only the fields the draft has), and the new source is made
	// before the old one is taken out in the same change: the drafts the plan promises are made from it.
	// The data steps in the order they must run, whatever order the plan listed them in:
	// 0 a field's rename (every later step finds the values under the new name), 1 an option's rename (the same, for its word),
	// 2 the fill of a required field of an option (for the entries that have the option chosen before this change gives it to others: the
	//   review's count is exactly these), 3 an option taken out (its entries are emptied or changed), 4 the rest in the plan's order (a
	//   removed field's values moved into an option's field go to the entries that have that option by now), 5 the fill of a field on
	//   its own (a new conditional field's choice among them), 6 a field moved into an option cleared where another is chosen (after the
	//   fills, so entries given that option keep it), 7 a language taken out, last.
	const order = (step: ChangeStep) =>
		step.do === "renameField"
			? 0
			: step.do === "renameOption"
				? 1
				: step.do === "removeOption"
					? 3
					: step.do === "fillField"
						? inner.has(step)
							? 2
							: 5
						: step.do === "keepChosen"
							? 6
							: step.do === "removeLocale"
								? 7
								: 4;
	return { steps: [...steps].sort((a, b) => order(a) - order(b)), missing };
}
