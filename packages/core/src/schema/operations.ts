import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { CheckError } from "../errors";
import { checkMediaValues } from "../media/uses";
import { defineOperation, type OperationContext } from "../operation";
import { defineRecordKind } from "../records";
import { AdminValues } from "./admin-values";
import { applyChange, pendingChanges, readSchemaState, setSchemaState } from "./apply";
import { checkSchema, type Schema } from "./define";
import type { ChangeFile } from "./files";
import { type Answers, type Rename as FieldRename, planSchema, schemaHash, stepsFor } from "./plan";

type Db = Kysely<Database> | Transaction<Database>;

// Zod shapes of the schema, for the operations' inputs (and so the agent's tools describe them).
const LocaleMode = z.enum(["same", "perLocale", "fromSource"]);
const FieldBase = { required: z.boolean().optional(), locale: LocaleMode.optional() };
const Field = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("text"),
		...FieldBase,
		multiline: z.boolean().optional(),
		max: z.number().optional(),
	}),
	z.object({ kind: z.literal("slug"), ...FieldBase, from: z.string().optional() }),
	z.object({ kind: z.literal("select"), ...FieldBase, options: z.array(z.string()), many: z.boolean().optional() }),
	z.object({ kind: z.literal("media"), ...FieldBase, accept: z.enum(["image", "any"]).optional() }),
	z.object({
		kind: z.literal("relation"),
		...FieldBase,
		to: z.string(),
		many: z.boolean().optional(),
		createMissing: z.boolean().optional(),
		ordered: z.boolean().optional(),
		via: z.string().optional(),
	}),
]);
export const LocalesInput = z.object({
	source: z.string(),
	list: z.array(z.object({ code: z.string(), name: z.string() })),
	prefix: z.enum(["always", "exceptSource", "never"]),
});
const SchemaInput: z.ZodType<Schema> = z.object({
	locales: LocalesInput,
	collections: z.record(
		z.string(),
		z.discriminatedUnion("kind", [
			z.object({
				kind: z.literal("document"),
				path: z.string(),
				previewPath: z.string().optional(),
				fields: z.record(z.string(), Field),
			}),
			z.object({ kind: z.literal("item"), path: z.string().optional(), fields: z.record(z.string(), Field) }),
		]),
	),
});
const Rename = z.object({ collection: z.string(), from: z.string(), to: z.string() });
const ChoiceInput = z.discriminatedUnion("do", [
	z.object({ do: z.literal("renameField"), values: z.enum(["move", "empty"]) }),
	z.object({ do: z.literal("removeField"), values: z.union([z.literal("clear"), z.object({ move: z.string() })]) }),
	z.object({ do: z.literal("addRequiredField"), fill: z.unknown() }),
	z.object({ do: z.literal("removeCollection"), confirm: z.literal(true) }),
	z.object({ do: z.literal("removeLocale"), confirm: z.literal(true) }),
]);
export const AnswersInput = z.record(z.string(), z.union([ChoiceInput, z.array(ChoiceInput)])).default({});

/** Refuses a draft that has problems or leaves a change that touches stored values unanswered. */
export async function checkApply(ctx: OperationContext, draft: Schema, renames: FieldRename[], answers: Answers) {
	if (checkSchema(draft).length > 0) throw new CheckError({ key: "schema.hasProblems" });
	const state = await readSchemaState(ctx.db);
	const changes = await planSchema(ctx.db, state?.schema ?? ctx.site.schema(), draft, renames);
	const { missing, steps } = stepsFor(changes, answers);
	if (missing.length > 0)
		throw new CheckError({ key: "schema.choicesMissing", values: { changes: missing.join(", ") } });
	// A media field filled for every empty entry takes a file the library has, as a save does.
	for (const step of steps)
		if (step.do === "fillField")
			await checkMediaValues(ctx.db, draft, step.collection, { [step.field]: step.value }, { missing: "refuse" });
}

/**
 * Applies a draft schema on the dev server (doc 01, and the languages of doc 04): the file and a change file first, then the change on the database.
 * When the database step fails, the files stay and "apply again" (`schema.retry`) applies them.
 */
export async function applySchema(
	ctx: OperationContext,
	draft: Schema,
	renames: FieldRename[],
	answers: Answers,
	adminValues: Record<string, AdminValues> = {},
) {
	const files = ctx.site.files;
	if (!files) throw new Error("Structure is locked on the live site.");
	const state = await readSchemaState(ctx.db);
	const changes = await planSchema(ctx.db, state?.schema ?? ctx.site.schema(), draft, renames);
	const { steps } = stepsFor(changes, answers);
	const now = ctx.now();
	const label = [...new Set(changes.map((change) => change.collection ?? "locales"))].join("-") || "schema";
	const change: ChangeFile = {
		id: changeId(now, label, randomUUID()),
		steps,
		...(Object.keys(adminValues).length > 0 ? { firstAdminValues: adminValues } : {}),
	};
	await files.write(draft, change, schemaHash(draft) !== schemaHash(ctx.site.schema()));
	ctx.site.setSchema(draft);
	await sql`savepoint schema_apply`.execute(ctx.db);
	try {
		await applyChange(ctx.db, change, draft, ctx.site.kit);
	} catch (error) {
		// The screen says only that applying failed; the developer finds the change file and the reason here.
		console.error(`Monti: change ${change.id} was saved to monti/changes but the database step failed:`, error);
		await sql`rollback to savepoint schema_apply`.execute(ctx.db);
		await setSchemaState(ctx.db, state?.schema ?? draft, change.id);
		return { changeId: change.id, applied: false, error: String(error), changes };
	}
	return { changeId: change.id, applied: true, changes };
}

/** The applied schema: its version guards against two saves over each other; it is never undone (a structure change has no undo). */
export const schemaRecord = defineRecordKind({
	kind: "schema",
	async load(db, ids) {
		const state = await readSchemaState(db);
		return state && ids.includes("current") ? [{ id: "current", version: state.version, data: state.hash }] : [];
	},
	async restore() {
		throw new Error("A structure change is not undone; make the opposite change.");
	},
});

export const adminValuesRecord = defineRecordKind({
	kind: "collectionAdminValues",
	async load(db, ids) {
		const rows = await db.selectFrom("collection_admin_values").selectAll().where("collection", "in", ids).execute();
		return rows.map((row) => ({ id: row.collection, version: row.version, data: row.values }));
	},
	async restore(db, id, data) {
		if (data === null) {
			await db.deleteFrom("collection_admin_values").where("collection", "=", id).execute();
			return;
		}
		const values = AdminValues.parse(data);
		await db
			.insertInto("collection_admin_values")
			.values({ collection: id, values: JSON.stringify(values) })
			.onConflict((conflict) =>
				conflict.column("collection").doUpdateSet((eb) => ({
					values: JSON.stringify(values),
					version: eb("collection_admin_values.version", "+", 1),
				})),
			)
			.execute();
	},
});

async function adminValuesOf(db: Db): Promise<Record<string, AdminValues & { version: number }>> {
	const rows = await db.selectFrom("collection_admin_values").selectAll().execute();
	return Object.fromEntries(rows.map((row) => [row.collection, { ...row.values, version: row.version }]));
}

/** A change file id: when, then what, then enough entropy for two saves in the same millisecond. */
const changeId = (now: Date, label: string, id: string) =>
	`${now.toISOString().replace("T", "-").replace(/[:.]/g, "").replace("Z", "")}-${label}-${id.slice(0, 8)}`;

export const schemaOperations = [
	defineOperation({
		name: "schema.read",
		kind: "read",
		description:
			"Read every collection and field with its admin values: labels and, for each field, its description (how to fill it). Also says whether structure is locked (live site) and whether the schema file changed since it was applied.",
		input: z.object({}),
		async run(_input, ctx) {
			const schema = ctx.site.schema();
			const state = await readSchemaState(ctx.db);
			const hash = schemaHash(schema);
			return {
				schema,
				hash,
				version: state?.version ?? 0,
				adminValues: await adminValuesOf(ctx.db),
				locked: ctx.site.files === null,
				/** The file differs from what the database follows: a hand edit on the dev server, or `monti db:migrate` not run on the live site. */
				fileChanged: state !== null && state.hash !== hash,
				failedChange: state?.failedChange ?? null,
			};
		},
	}),
	defineOperation({
		name: "schema.check",
		kind: "read",
		description:
			"List what a draft schema must fix before it can be applied (a select without options, a relation to no collection…).",
		input: z.object({ draft: SchemaInput }),
		run: (input) => checkSchema(input.draft),
	}),
	defineOperation({
		name: "schema.plan",
		kind: "read",
		description:
			"Compare a draft schema with the applied one: each change, how many entries it touches, and what the review must choose for changes that touch stored values. Renamed fields must be named in renames.",
		input: z.object({ draft: SchemaInput, renames: z.array(Rename).default([]) }),
		async run(input, ctx) {
			const state = await readSchemaState(ctx.db);
			return {
				problems: checkSchema(input.draft),
				changes: await planSchema(ctx.db, state?.schema ?? ctx.site.schema(), input.draft, input.renames),
			};
		},
	}),
	defineOperation({
		name: "schema.apply",
		kind: "write",
		structure: true,
		description:
			"Apply a draft schema on the dev server: writes monti.schema.ts and a change file, then applies it to the database. Every change that touches stored values needs an answer from schema.plan's choices. adminValues gives labels and help for what the draft creates.",
		input: z.object({
			draft: SchemaInput,
			renames: z.array(Rename).default([]),
			answers: AnswersInput,
			adminValues: z.record(z.string(), AdminValues).default({}),
		}),
		touches: () => [{ kind: "schema", id: "current" }],
		check: (input, ctx) => checkApply(ctx, input.draft, input.renames, input.answers as Answers),
		async run(input, ctx) {
			const output = await applySchema(ctx, input.draft, input.renames, input.answers as Answers, input.adminValues);
			if (output.applied) ctx.emit({ type: "schema.applied", ids: [output.changeId] });
			return output;
		},
		log: "settings",
		summary: (_input, output) => ({
			key: output.applied ? "schema.applied" : "schema.applyFailed",
			values: { change: output.changeId },
		}),
		where: () => ({ key: "activity.where.schema" }),
	}),
	defineOperation({
		name: "schema.retry",
		kind: "write",
		structure: true,
		description:
			"Apply again the change files the database has not followed, after an apply whose database step failed.",
		input: z.object({}),
		touches: () => [{ kind: "schema", id: "current" }],
		async run(_input, ctx) {
			const files = ctx.site.files;
			if (!files) throw new Error("Structure is locked on the live site.");
			const pending = await pendingChanges(ctx.db, await files.readChanges());
			for (const change of pending) await applyChange(ctx.db, change, ctx.site.schema(), ctx.site.kit);
			await setSchemaState(ctx.db, ctx.site.schema(), null);
			return { applied: pending.map((change) => change.id) };
		},
		log: "settings",
		summary: (_input, output) => ({ key: "schema.retried", values: { count: output.applied.length } }),
		where: () => ({ key: "activity.where.schema" }),
	}),
	defineOperation({
		name: "collections.updateAdminValues",
		kind: "write",
		description:
			"Save a collection's admin values: its label, folders, field labels and descriptions (how to fill each field), the property panel layout and the editor's allowed blocks. Works on the live site too.",
		input: z.object({ collection: z.string(), values: AdminValues }),
		touches: (input) => [{ kind: "collectionAdminValues", id: input.collection }],
		check(input, ctx) {
			if (!ctx.site.schema().collections[input.collection])
				throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
		},
		async run(input, ctx) {
			const existed = (await adminValuesRecord.load(ctx.db, [input.collection])).length > 0;
			await adminValuesRecord.restore(ctx.db, input.collection, input.values);
			if (!existed) ctx.created({ kind: "collectionAdminValues", id: input.collection });
			ctx.emit({ type: "settings.saved", ids: [input.collection], collection: input.collection });
		},
		log: "settings",
		summary: (input) => ({ key: "collections.updateAdminValues", values: { collection: input.collection } }),
		where: () => ({ key: "activity.where.settings" }),
	}),
	defineOperation({
		name: "collections.export",
		kind: "read",
		description: "Export one collection: its definition, admin values and every entry (trashed ones included) as JSON.",
		input: z.object({ collection: z.string() }),
		async run(input, ctx) {
			const definition = ctx.site.schema().collections[input.collection];
			if (!definition) throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
			return {
				collection: input.collection,
				definition,
				adminValues: (await adminValuesOf(ctx.db))[input.collection] ?? null,
				entries: await ctx.db
					.selectFrom("entries")
					.selectAll()
					.where("collection", "=", input.collection)
					.orderBy("created_at")
					.execute(),
			};
		},
	}),
];

export const schemaRecordKinds = [schemaRecord, adminValuesRecord];
