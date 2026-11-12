import { type Kysely, sql, type Transaction } from "kysely";
import { fingerprint } from "../bytes";
import type { Database } from "../db/schema";
import { canonical, sameJson } from "../json";
import {
	type CollectionDefinition,
	type FieldDefinition,
	type LocalesDefinition,
	type Schema,
	storedFields,
} from "./define";
import type { ChangeStep } from "./files";

type Db = Kysely<Database> | Transaction<Database>;

/** A field the admin renamed (the server cannot tell a rename from a remove and an add, so the draft says so). */
export type Rename = { collection: string; from: string; to: string };

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
		| "addLocale"
		| "removeLocale"
		| "changeSource"
		| "changePrefix";
	/** Absent for a change of the languages (doc 04). */
	collection?: string;
	field?: string;
	/** For an option taken out of a conditional field, the option. */
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

async function countEntries(db: Db, collection: string, where: ReturnType<typeof sql<boolean>>) {
	const row = await db
		.selectFrom("entries")
		.select((eb) => eb.fn.countAll<string>().as("all"))
		.where("collection", "=", collection)
		.where(where)
		.executeTakeFirstOrThrow();
	return Number(row.all);
}

/**
 * What saving `draft` over `current` changes, with the entries each change touches and what the review must ask. Nothing is written. The review asks
 * about every change that can touch stored values on the live site, even when this (dev) database has none (doc 01, principle 4).
 */
export async function planSchema(
	db: Db,
	current: Schema,
	draft: Schema,
	renames: Rename[] = [],
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
		changes.push(...(await planFields(db, name, before, collection, renames)));
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
): Promise<SchemaChange[]> {
	// By the fields as they are stored (doc 19): a field moved into a conditional field's group, or from one group to another, keeps its
	// name and its values; an option taken out takes its group's fields with it, and they are asked about as any removed field is.
	const before = { fields: storedFields(beforeCollection) };
	const after = { fields: storedFields(afterCollection) };
	const changes: SchemaChange[] = [];
	const renamed = renames.filter(
		(rename) => rename.collection === collection && before.fields[rename.from] && after.fields[rename.to],
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
			count: await countEntries(db, collection, hasValue(rename.from)),
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
			count: await countEntries(db, collection, hasValue(field)),
			choices: [
				{ do: "removeField", values: "clear" },
				...movable.map((target) => ({ do: "removeField" as const, values: { move: target } })),
			],
		});
	}

	for (const [field, definition] of Object.entries(after.fields)) {
		const old = before.fields[field];
		if (renamedTo.has(field)) continue;
		if (!old) changes.push(await planNewField(db, collection, field, definition));
		else if (!sameJson(old, definition) || (definition.required && !old.required)) {
			const change =
				definition.required && !old.required
					? await planNewField(db, collection, field, definition, "changeField")
					: ({ id: `changeField:${collection}.${field}`, do: "changeField", collection, field } as SchemaChange);
			changes.push(change);
			// An option taken out of a conditional field (doc 19): the review asks what becomes of the entries that chose it, as it asks about a
			// removed field's values. They are left with no choice, or given one of the options that stay.
			const gone =
				old.kind === "select" && definition.kind === "select" && hangsOn(afterCollection, beforeCollection, field)
					? old.options.filter((option) => !definition.options.includes(option))
					: [];
			const stay = definition.kind === "select" ? definition.options : [];
			for (const option of gone)
				changes.push({
					id: `removeOption:${collection}.${field}.${option}`,
					do: "removeOption",
					collection,
					field,
					option,
					count: await countEntries(db, collection, sql<boolean>`values->>${field} = ${option}`),
					choices: [
						{ do: "removeOption", entries: "empty" },
						...stay.map((to) => ({ do: "removeOption" as const, entries: { change: to } })),
					],
				});
		}
	}
	return changes;
}

/** Whether the field is a conditional field's choice, before or after the change. */
const hangsOn = (after: CollectionDefinition, before: CollectionDefinition, field: string) =>
	after.fields[field]?.kind === "conditional" || before.fields[field]?.kind === "conditional";

async function planNewField(
	db: Db,
	collection: string,
	field: string,
	definition: FieldDefinition,
	kind: "addField" | "changeField" = "addField",
): Promise<SchemaChange> {
	const change: SchemaChange = { id: `${kind}:${collection}.${field}`, do: kind, collection, field };
	if (definition.required) {
		change.count = await countEntries(db, collection, sql<boolean>`not ${hasValue(field)}`);
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
	const missing: string[] = [];
	for (const change of changes) {
		if (change.do === "changeSource")
			steps.push({ do: "changeSource", from: String(change.from), to: String(change.locale) });
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
			if (choice.do === "addRequiredField" && choice.fill !== null)
				steps.push({ do: "fillField", collection, field, value: choice.fill });
		}
	}
	// A language leaves last. The collections' steps keep their place before the languages' (a renamed or moved field's values are under their
	// new name by the time a new source language is made from the old one, which keeps only the fields the draft has), and the new source is made
	// before the old one is taken out in the same change: the drafts the plan promises are made from it.
	const last = (step: ChangeStep) => (step.do === "removeLocale" ? 1 : 0);
	return { steps: [...steps].sort((a, b) => last(a) - last(b)), missing };
}
