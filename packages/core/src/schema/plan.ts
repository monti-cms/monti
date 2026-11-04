import { createHash } from "node:crypto";
import { type Kysely, sql, type Transaction } from "kysely";
import type { Database } from "../db/schema";
import type { CollectionDefinition, FieldDefinition, Schema } from "./define";
import type { ChangeStep } from "./files";

type Db = Kysely<Database> | Transaction<Database>;

/** A field the admin renamed (the server cannot tell a rename from a remove and an add, so the draft says so). */
export type Rename = { collection: string; from: string; to: string };

/** What a person chooses for a change that touches stored values (doc 01, the review table). The first option is the default. */
export type Choice =
	| { do: "renameField"; values: "move" | "empty" }
	| { do: "removeField"; values: "clear" | { move: string } }
	| { do: "addRequiredField"; fill: unknown | null }
	| { do: "removeCollection"; confirm: true };

export type SchemaChange = {
	/** Stable within a plan: the review answers a change by this id. */
	id: string;
	do: "addCollection" | "removeCollection" | "changePath" | "addField" | "removeField" | "renameField" | "changeField";
	collection: string;
	field?: string;
	/** For a rename, the old name; for a path change, the old path. */
	from?: string;
	to?: string;
	/**
	 * How many entries it touches in this database: with values, empty, published, or all (for a removed collection; `trashed` of them in the trash).
	 * On the dev server this is the dev data; the live site may have more, so a count never decides whether the review asks.
	 */
	count?: number;
	trashed?: number;
	/** What the review asks, with the default first. Absent when the change touches no stored value. */
	choices?: Choice[];
};

/** The same hash for the same schema, whatever the key order. */
export function schemaHash(schema: Schema): string {
	const canonical = (value: unknown): unknown =>
		Array.isArray(value)
			? value.map(canonical)
			: typeof value === "object" && value !== null
				? Object.fromEntries(
						Object.keys(value)
							.sort()
							.map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
					)
				: value;
	return createHash("sha256")
		.update(JSON.stringify(canonical(schema)))
		.digest("hex")
		.slice(0, 16);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Entries of a collection whose value for `field` is not empty. Trashed entries count: their values come back with them. */
const hasValue = (field: string) => sql<boolean>`coalesce(values->>${field}, '') <> ''`;

async function countEntries(db: Db, collection: string, where?: ReturnType<typeof sql<boolean>>) {
	let query = db
		.selectFrom("entries")
		.select((eb) => [eb.fn.countAll<string>().as("all"), eb.fn.count<string>("trashed_at").as("trashed")])
		.where("collection", "=", collection);
	if (where) query = query.where(where);
	const row = await query.executeTakeFirstOrThrow();
	return { all: Number(row.all), trashed: Number(row.trashed) };
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
				count: (await countEntries(db, name, sql<boolean>`status = 'published' and trashed_at is null`)).all,
			});
		changes.push(...(await planFields(db, name, before, collection, renames)));
	}
	for (const name of Object.keys(current.collections))
		if (!draft.collections[name]) {
			const { all, trashed } = await countEntries(db, name);
			changes.push({
				id: `removeCollection:${name}`,
				do: "removeCollection",
				collection: name,
				count: all,
				trashed,
				choices: [{ do: "removeCollection", confirm: true }],
			});
		}
	return changes;
}

async function planFields(
	db: Db,
	collection: string,
	before: CollectionDefinition,
	after: CollectionDefinition,
	renames: Rename[],
): Promise<SchemaChange[]> {
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
			count: (await countEntries(db, collection, hasValue(rename.from))).all,
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
			count: (await countEntries(db, collection, hasValue(field))).all,
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
		else if (!same(old, definition) || (definition.required && !old.required))
			changes.push(
				definition.required && !old.required
					? await planNewField(db, collection, field, definition, "changeField")
					: { id: `changeField:${collection}.${field}`, do: "changeField", collection, field },
			);
	}
	return changes;
}

async function planNewField(
	db: Db,
	collection: string,
	field: string,
	definition: FieldDefinition,
	kind: "addField" | "changeField" = "addField",
): Promise<SchemaChange> {
	const change: SchemaChange = { id: `${kind}:${collection}.${field}`, do: kind, collection, field };
	if (definition.required) {
		change.count = (await countEntries(db, collection, sql<boolean>`not ${hasValue(field)}`)).all;
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
		if (!change.choices) continue;
		const given = ([] as Choice[]).concat(answers[change.id] ?? []);
		const kinds = new Set(change.choices.map((choice) => choice.do));
		const answer = (kind: Choice["do"]) => given.find((choice) => choice.do === kind);
		if ([...kinds].some((kind) => !answer(kind))) {
			missing.push(change.id);
			continue;
		}
		const collection = change.collection;
		const field = change.field as string;
		for (const choice of given) {
			if (choice.do === "removeCollection") steps.push({ do: "removeCollection", collection });
			if (choice.do === "renameField")
				steps.push({ do: "renameField", collection, from: change.from as string, to: field, values: choice.values });
			if (choice.do === "removeField") steps.push({ do: "removeField", collection, field, values: choice.values });
			if (choice.do === "addRequiredField" && choice.fill !== null)
				steps.push({ do: "fillField", collection, field, value: choice.fill });
		}
	}
	return { steps, missing };
}
