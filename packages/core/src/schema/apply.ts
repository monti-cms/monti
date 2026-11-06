import { type Kysely, sql, type Transaction } from "kysely";
import { type BlockKit, createBlockKit } from "../body/blocks";
import type { Database } from "../db/schema";
import { changeSource } from "../translations/source-change";
import type { AdminValues } from "./admin-values";
import type { Schema } from "./define";
import type { ChangeFile, ChangeStep } from "./files";
import { schemaHash } from "./plan";

type Db = Kysely<Database> | Transaction<Database>;

const empty = (field: string) => sql<boolean>`coalesce(values->>${field}, '') = ''`;

/**
 * A field's admin values (its label, help, place in the layout) follow the field: a rename carries them to the new name, a removal drops them. The
 * live site applies the same steps, so its labels follow too (doc 01).
 */
async function followField(db: Db, collection: string, from: string, to: string | null) {
	const row = await db
		.selectFrom("collection_admin_values")
		.select("values")
		.where("collection", "=", collection)
		.executeTakeFirst();
	if (!row) return;
	const values = row.values as AdminValues;
	type Layout = NonNullable<AdminValues["layout"]>;
	const rename = (names: string[]) => names.flatMap((name) => (name !== from ? [name] : to ? [to] : []));
	const { [from]: moved, ...fields } = values.fields ?? {};
	const next: AdminValues = {
		...values,
		...(values.fields ? { fields: moved && to ? { ...fields, [to]: moved } : fields } : {}),
		...(values.layout
			? {
					layout: values.layout.map((tab) => ({
						...tab,
						fields: tab.fields.flatMap((each): Layout[number]["fields"] =>
							typeof each === "string" ? rename([each]) : [{ ...each, fields: rename(each.fields) }],
						),
					})),
				}
			: {}),
	};
	await db
		.updateTable("collection_admin_values")
		.set((eb) => ({ values: JSON.stringify(next), version: eb("version", "+", 1) }))
		.where("collection", "=", collection)
		.execute();
}

async function applyStep(db: Db, step: ChangeStep, schema: Schema, kit: BlockKit) {
	if (step.do === "removeLocale") {
		// What the site shows and old paths go with the entries (cascade).
		await db.deleteFrom("entries").where("locale", "=", step.locale).execute();
		return;
	}
	if (step.do === "changeSource") {
		await changeSource(db, step.from, step.to, schema, kit);
		return;
	}
	// A field step changes the working copy and what the site shows alike (doc 02): the site's code changes with the schema.
	const entries = async (set: ReturnType<typeof sql>, where: ReturnType<typeof sql<boolean>>) => {
		await sql`update entries set values = ${set}, version = version + 1, updated_at = now() where collection = ${step.collection} and ${where}`.execute(
			db,
		);
		await sql`update entry_published set values = ${set} where collection = ${step.collection} and ${where}`.execute(
			db,
		);
	};
	switch (step.do) {
		case "removeCollection": {
			const groups = db.selectFrom("entries").select("translation_group").where("collection", "=", step.collection);
			await db
				.deleteFrom("entry_links")
				.where((eb) => eb.or([eb("from_group", "in", groups), eb("to_group", "in", groups)]))
				.execute();
			await db.deleteFrom("entries").where("collection", "=", step.collection).execute();
			await db.deleteFrom("collection_admin_values").where("collection", "=", step.collection).execute();
			return;
		}
		case "renameField":
			// "empty": the new field starts empty and the old name's values go with it.
			if (step.values === "empty") await entries(sql`values - ${step.from}::text`, sql<boolean>`values ? ${step.from}`);
			else
				await entries(
					sql`(values - ${step.from}::text) || jsonb_build_object(${step.to}::text, values->${step.from})`,
					sql<boolean>`values ? ${step.from}`,
				);
			await followField(db, step.collection, step.from, step.to);
			return;
		case "removeField":
			if (step.values === "clear")
				await entries(sql`values - ${step.field}::text`, sql<boolean>`values ? ${step.field}`);
			else if (typeof step.values === "object")
				await entries(
					sql`(values - ${step.field}::text) || jsonb_build_object(${step.values.move}::text, coalesce(nullif(values->${step.values.move}, '""'::jsonb), values->${step.field}))`,
					sql<boolean>`values ? ${step.field}`,
				);
			await followField(db, step.collection, step.field, null);
			return;
		case "fillField":
			await entries(
				sql`values || jsonb_build_object(${step.field}::text, ${JSON.stringify(step.value)}::jsonb)`,
				empty(step.field),
			);
			return;
	}
}

/**
 * Read views, one per collection, one column per field (`monti_post`), so a developer opening the database reads entries as a table. Rebuilt on every
 * apply; views of collections the schema no longer has are dropped.
 */
async function rebuildViews(db: Db, previous: Schema | null, schema: Schema) {
	for (const name of Object.keys(previous?.collections ?? {}))
		await sql`drop view if exists ${sql.id(`monti_${name}`)}`.execute(db);
	// A view's definition takes no bound parameters, so field names go in as literals (they are identifiers, checked by checkSchema).
	for (const [name, collection] of Object.entries(schema.collections)) {
		const fields = Object.entries(collection.fields)
			.filter(([field]) => field !== "title" && field !== "slug")
			.map(([field, definition]) =>
				definition.kind === "text" || (definition.kind === "select" && !definition.many)
					? sql`values->>${sql.lit(field)} as ${sql.id(field)}`
					: sql`values->${sql.lit(field)} as ${sql.id(field)}`,
			);
		await sql`create view ${sql.id(`monti_${name}`)} as select id, translation_group, locale, slug, title, status, folder_id, ${sql.join(
			[...fields, sql`created_at`, sql`updated_at`],
		)} from entries where collection = ${sql.lit(name)} and trashed_at is null`.execute(db);
	}
}

export type SchemaState = { version: number; hash: string; schema: Schema; failedChange: string | null };

export async function readSchemaState(db: Db): Promise<SchemaState | null> {
	const row = await db.selectFrom("schema_state").selectAll().executeTakeFirst();
	return row
		? { version: row.version, hash: row.applied_hash, schema: row.applied_schema, failedChange: row.failed_change }
		: null;
}

/**
 * Follows one change file: its steps, then the admin values it brings for what it created (a new collection's row, a new field of an existing one),
 * put in only where the database has none. What the database already has is never replaced: from then on the database owns those values.
 */
async function followChange(db: Db, change: ChangeFile, schema: Schema, kit: BlockKit): Promise<void> {
	for (const step of change.steps) await applyStep(db, step, schema, kit);
	for (const [collection, first] of Object.entries(change.firstAdminValues ?? {}))
		await sql`insert into collection_admin_values (collection, values) values (${collection}, ${JSON.stringify(first)}::jsonb)
			on conflict (collection) do update set
				values = excluded.values || collection_admin_values.values
					|| jsonb_build_object('fields', coalesce(excluded.values->'fields', '{}'::jsonb) || coalesce(collection_admin_values.values->'fields', '{}'::jsonb)),
				version = collection_admin_values.version + 1`.execute(db);
	await db.insertInto("schema_changes").values({ id: change.id }).execute();
}

/** Applies one change file and records the schema it leaves. Run inside the write's transaction, so a failed step leaves the database as it was. */
export async function applyChange(db: Db, change: ChangeFile, schema: Schema, kit: BlockKit): Promise<void> {
	await followChange(db, change, schema, kit);
	await setSchemaState(db, schema, null);
}

export async function setSchemaState(db: Db, schema: Schema, failedChange: string | null): Promise<void> {
	const previous = await readSchemaState(db);
	if (!previous || previous.hash !== schemaHash(schema)) await rebuildViews(db, previous?.schema ?? null, schema);
	const values = {
		version: (previous?.version ?? 0) + 1,
		applied_hash: schemaHash(schema),
		applied_schema: JSON.stringify(schema),
		failed_change: failedChange,
	};
	await db
		.insertInto("schema_state")
		.values({ id: 1, ...values })
		.onConflict((conflict) => conflict.column("id").doUpdateSet(values))
		.execute();
}

/** Change files this database has not followed yet, in order. */
export async function pendingChanges(db: Db, changes: ChangeFile[]): Promise<ChangeFile[]> {
	const done = new Set((await db.selectFrom("schema_changes").select("id").execute()).map((row) => row.id));
	return changes.filter((change) => !done.has(change.id));
}

/**
 * `monti db:migrate` (and `db:setup`): follows every pending change file, then records the schema the site's code runs with. All or nothing, in one
 * transaction.
 */
export async function migrateContent(
	db: Kysely<Database>,
	schema: Schema,
	changes: ChangeFile[],
	kit: BlockKit = createBlockKit([], []),
): Promise<string[]> {
	return db.transaction().execute(async (trx) => {
		const pending = await pendingChanges(trx, changes);
		for (const change of pending) await followChange(trx, change, schema, kit);
		await setSchemaState(trx, schema, null);
		return pending.map((change) => change.id);
	});
}
