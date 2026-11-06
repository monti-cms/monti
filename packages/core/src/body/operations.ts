import { z } from "zod";
import { randomUUID } from "../bytes";
import { editableEntry, entryOf, saveWorking } from "../entries/operations";
import { CheckError, ConflictError } from "../errors";
import { defineOperation, type OperationContext, type RecordRef } from "../operation";
import { defineRecordKind } from "../records";
import { keepLinks } from "../translations/links";
import { addSkips, followedHashes } from "../translations/source";
import { blockOn, markOn } from "./blocks";
import { assertDoc, editorOf } from "./check";
import { asDoc, type Doc, DocShape, plainText, walk } from "./doc";
import { applyOps, BodyOpShape } from "./edit";
import { bodyText } from "./text";

const templateRef = (id: string): RecordRef => ({ kind: "template", id });

/** A template for the engine, so saving and removing one can be undone like any admin value. */
export const templateRecord = defineRecordKind({
	kind: "template",
	async load(db, ids) {
		if (ids.length === 0) return [];
		const rows = await db.selectFrom("templates").selectAll().where("id", "in", ids).execute();
		return rows.map((row) => ({ id: row.id, version: row.version, data: row }));
	},
	async restore(db, id, data) {
		if (data === null) {
			await db.deleteFrom("templates").where("id", "=", id).execute();
			return;
		}
		const row = data as { name: string; doc: unknown; version: number; created_at: string };
		const values = { name: row.name, doc: JSON.stringify(row.doc), updated_at: new Date() };
		await db
			.insertInto("templates")
			.values({ id, ...values, created_at: new Date(row.created_at), version: row.version + 1 })
			.onConflict((conflict) =>
				conflict.column("id").doUpdateSet((eb) => ({ ...values, version: eb("templates.version", "+", 1) })),
			)
			.execute();
	},
});

async function templateOf(ctx: OperationContext, id: string) {
	const row = await ctx.db.selectFrom("templates").selectAll().where("id", "=", id).executeTakeFirst();
	if (!row) throw new CheckError({ key: "templates.unknown", values: { id } });
	return row;
}

/** An entry's body after the block operations, checked as a person's save would be. */
async function editedBody(
	ctx: OperationContext,
	input: { id: string; version: number; ops: z.infer<typeof BodyOpShape>[] },
) {
	const entry = await editableEntry(ctx, input.id, input.version);
	const next = applyOps(asDoc(entry.doc), input.ops);
	assertDoc(next, ctx.site.kit, (entry.doc as Doc | null) ?? null);
	return { entry, next };
}

export const bodyOperations = [
	defineOperation({
		name: "blocks.catalog",
		kind: "read",
		description:
			"The blocks and marks the editor of a collection offers: for each block its description, what it holds and its attrs JSON schema. Read it before inserting or changing blocks. Without a collection: every block and mark the site has.",
		input: z.object({ collection: z.string().optional() }),
		async run(input, ctx) {
			const editor = input.collection === undefined ? undefined : await editorOf(ctx.db, input.collection);
			return {
				blocks: [...ctx.site.kit.blocks.values()]
					.filter((block) => blockOn(editor, { type: block.type }))
					.map((block) => ({
						type: block.type,
						label: block.label,
						description: block.description,
						menu: block.menu ?? null,
						holds: block.holds,
						children: block.children ?? null,
						attrs: block.attrs ? z.toJSONSchema(block.attrs, { io: "input", unrepresentable: "any" }) : null,
					})),
				marks: [...ctx.site.kit.marks.values()]
					.filter((mark) => markOn(editor, mark.type))
					.map((mark) => ({
						type: mark.type,
						label: mark.label,
						attrs: mark.attrs ? z.toJSONSchema(mark.attrs, { io: "input", unrepresentable: "any" }) : null,
					})),
				headings: editor?.headings ?? [2, 3, 4],
			};
		},
	}),
	defineOperation({
		name: "body.read",
		kind: "read",
		description:
			"Read an entry's body as short text, each block tagged with its id ({#b_1}). The text after the tag is the block's plain text, the one replaceText offsets count in. Give blocks to read only some.",
		input: z.object({ id: z.string(), blocks: z.array(z.string()).optional() }),
		async run(input, ctx) {
			const entry = await entryOf(ctx, input.id);
			return { version: entry.version, text: bodyText(asDoc(entry.doc), input.blocks) };
		},
	}),
	defineOperation({
		name: "body.edit",
		kind: "write",
		description:
			"Change an entry's body with block operations, never by rewriting it: replaceText inside one block, setBlock, insert after a block (null: first), move, remove. Blocks are named by id from body.read; new blocks get new ids. Give the entry version you read.",
		input: z.object({ id: z.string(), version: z.number().int(), ops: z.array(BodyOpShape).min(1) }),
		touches: (input) => [{ kind: "entry", id: input.id }],
		preview: (input) => ({
			summary: { key: "body.edit", values: { count: input.ops.length } },
			changes: [{ kind: "entry", id: input.id }],
		}),
		async check(input, ctx) {
			await editedBody(ctx, input);
		},
		async run(input, ctx) {
			const { entry, next } = await editedBody(ctx, input);
			// In a translation, an edit of a paired block's words is its translation against the source block as it is now (doc 04).
			const edited = new Set(
				input.ops.flatMap((op) => (op.op === "replaceText" || op.op === "setBlock" ? [op.block] : [])),
			);
			const retranslated = new Set(
				next.blocks.filter((top) => [...walk([top])].some(({ block }) => edited.has(block.id))).map((top) => top.id),
			);
			const hashes = await followedHashes(ctx.db, ctx.site.schema(), entry);
			const { doc, skipped } = keepLinks(asDoc(entry.doc), next, hashes, retranslated);
			const saved = await saveWorking(ctx, entry, { ...entry, doc });
			await addSkips(ctx.db, entry, skipped);
			return saved;
		},
		summary: (input) => ({ key: "body.edit", values: { count: input.ops.length } }),
	}),
	defineOperation({
		name: "templates.list",
		kind: "read",
		description:
			"List the body templates, one list for the whole site, each with the text of its headings (its sections).",
		input: z.object({}),
		async run(_input, ctx) {
			const rows = await ctx.db.selectFrom("templates").selectAll().orderBy("name").execute();
			return rows.map((row) => ({
				id: row.id,
				name: row.name,
				sections: [...walk(asDoc(row.doc).blocks)]
					.filter(({ block }) => block.type === "heading")
					.map(({ block }) => plainText(block.content)),
				version: row.version,
				updatedAt: row.updated_at,
			}));
		},
	}),
	defineOperation({
		name: "templates.get",
		kind: "read",
		description: "Read one body template with its body.",
		input: z.object({ id: z.string() }),
		run: (input, ctx) => templateOf(ctx, input.id),
	}),
	defineOperation({
		name: "templates.save",
		kind: "write",
		description:
			"Create a body template (no id) or change one (its id and the version you read). Its body passes the same check as an entry's, against every block the site has.",
		input: z.object({
			id: z.string().optional(),
			version: z.number().int().optional(),
			name: z.string().min(1),
			doc: DocShape,
		}),
		touches: (input) => (input.id ? [templateRef(input.id)] : []),
		async check(input, ctx) {
			const previous = input.id ? await templateOf(ctx, input.id) : null;
			if (previous && previous.version !== input.version)
				throw new ConflictError([
					{ ref: templateRef(previous.id), expected: input.version ?? 0, actual: previous.version },
				]);
			assertDoc(input.doc, ctx.site.kit, (previous?.doc as Doc | undefined) ?? null);
		},
		async run(input, ctx) {
			if (input.id) {
				await ctx.db
					.updateTable("templates")
					.set((eb) => ({
						name: input.name,
						doc: JSON.stringify(input.doc),
						version: eb("version", "+", 1),
						updated_at: ctx.now(),
					}))
					.where("id", "=", input.id)
					.execute();
				return { id: input.id };
			}
			const id = randomUUID();
			await ctx.db
				.insertInto("templates")
				.values({ id, name: input.name, doc: JSON.stringify(input.doc) })
				.execute();
			ctx.created(templateRef(id));
			return { id };
		},
		summary: (input) => ({ key: "templates.save", values: { name: input.name } }),
	}),
	defineOperation({
		name: "templates.duplicate",
		kind: "write",
		description: "Copy a body template under a new name (the same name when left out).",
		input: z.object({ id: z.string(), name: z.string().min(1).optional() }),
		async run(input, ctx) {
			const template = await templateOf(ctx, input.id);
			const id = randomUUID();
			await ctx.db
				.insertInto("templates")
				.values({ id, name: input.name ?? template.name, doc: JSON.stringify(template.doc) })
				.execute();
			ctx.created(templateRef(id));
			return { id };
		},
		summary: (input) => ({ key: "templates.duplicate", values: { id: input.id } }),
	}),
	defineOperation({
		name: "templates.remove",
		kind: "write",
		description:
			"Remove a body template. Entries started from it keep their bodies. It can be undone from the activity log.",
		input: z.object({ id: z.string() }),
		touches: (input) => [templateRef(input.id)],
		async run(input, ctx) {
			await templateOf(ctx, input.id);
			await ctx.db.deleteFrom("templates").where("id", "=", input.id).execute();
			return { id: input.id };
		},
		summary: (input) => ({ key: "templates.remove", values: { id: input.id } }),
	}),
];
