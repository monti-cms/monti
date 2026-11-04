import type { Kysely } from "kysely";
import { z } from "zod";
import { CheckError } from "../errors";
import { defineOperation, type OperationContext } from "../operation";
import { defineRecordKind } from "../records";

/** A small record kind for the engine's tests: notes in folders. */
export type NotesTables = {
	note: { id: string; version: number; body: string; folder_id: string | null };
	folder: { id: string; version: number; name: string };
};

type NotesDb = Kysely<NotesTables>;
const notes = (ctx: OperationContext) => ctx.db as unknown as NotesDb;

export async function createNotesTables(db: NotesDb) {
	await db.schema
		.createTable("note")
		.addColumn("id", "text", (column) => column.primaryKey())
		.addColumn("version", "integer", (column) => column.notNull())
		.addColumn("body", "text", (column) => column.notNull())
		.addColumn("folder_id", "text")
		.execute();
	await db.schema
		.createTable("folder")
		.addColumn("id", "text", (column) => column.primaryKey())
		.addColumn("version", "integer", (column) => column.notNull())
		.addColumn("name", "text", (column) => column.notNull())
		.execute();
}

const tableKind = (kind: "note" | "folder") =>
	defineRecordKind({
		kind,
		async load(db, ids) {
			const rows = await (db as unknown as NotesDb).selectFrom(kind).selectAll().where("id", "in", ids).execute();
			return rows.map((row) => ({ id: row.id, version: row.version, data: row }));
		},
		async restore(db, id, data) {
			const table = db as unknown as NotesDb;
			const current = await table.selectFrom(kind).select("version").where("id", "=", id).executeTakeFirst();
			await table.deleteFrom(kind).where("id", "=", id).execute();
			if (data !== null)
				await table
					.insertInto(kind)
					.values({ ...(data as object), version: (current?.version ?? 0) + 1 } as never)
					.execute();
		},
	});

export const noteKinds = [tableKind("note"), tableKind("folder")];

export const notesCreate = defineOperation({
	name: "notes.create",
	kind: "write",
	description: "Create a note.",
	input: z.object({ id: z.string(), body: z.string(), folderId: z.string().nullable().default(null) }),
	async run(input, ctx) {
		await notes(ctx)
			.insertInto("note")
			.values({ id: input.id, version: 1, body: input.body, folder_id: input.folderId })
			.execute();
		ctx.created({ kind: "note", id: input.id });
		ctx.emit({ type: "note.created", ids: [input.id] });
		return { id: input.id };
	},
	summary: () => ({ key: "notes.create" }),
});

export const notesEdit = defineOperation({
	name: "notes.edit",
	kind: "write",
	description: "Replace the body of notes.",
	input: z.object({ ids: z.array(z.string()).min(1), body: z.string() }),
	touches: (input) => input.ids.map((id) => ({ kind: "note", id })),
	async run(input, ctx) {
		for (const id of input.ids)
			await notes(ctx)
				.updateTable("note")
				.set((eb) => ({ body: input.body, version: eb("version", "+", 1) }))
				.where("id", "=", id)
				.execute();
		ctx.emit({ type: "note.edited", ids: input.ids });
	},
	summary: (input) => ({ key: "notes.edit", values: { count: input.ids.length } }),
});

export const foldersCreate = defineOperation({
	name: "folders.create",
	kind: "write",
	description: "Create a folder; returns its id.",
	input: z.object({ name: z.string() }),
	async run(input, ctx) {
		const id = `folder-${input.name}`;
		await notes(ctx).insertInto("folder").values({ id, version: 1, name: input.name }).execute();
		ctx.created({ kind: "folder", id });
		return { id };
	},
	summary: () => ({ key: "folders.create" }),
});

export const notesMove = defineOperation({
	name: "notes.move",
	kind: "write",
	description: "Move notes into a folder.",
	input: z.object({ ids: z.array(z.string()).min(1), folderId: z.string() }),
	touches: (input) => input.ids.map((id) => ({ kind: "note", id })),
	async check(input, ctx) {
		const folder = await notes(ctx)
			.selectFrom("folder")
			.select("id")
			.where("id", "=", input.folderId)
			.executeTakeFirst();
		if (!folder) throw new CheckError({ key: "folders.missing" });
	},
	async run(input, ctx) {
		await notes(ctx)
			.updateTable("note")
			.set((eb) => ({ folder_id: input.folderId, version: eb("version", "+", 1) }))
			.where("id", "in", input.ids)
			.execute();
	},
	summary: (input) => ({ key: "notes.move", values: { count: input.ids.length } }),
});

export const notesPurge = defineOperation({
	name: "notes.purge",
	kind: "write",
	humanOnly: true,
	description: "Delete notes for good.",
	input: z.object({ ids: z.array(z.string()).min(1) }),
	async run(input, ctx) {
		await notes(ctx).deleteFrom("note").where("id", "in", input.ids).execute();
	},
	summary: () => ({ key: "notes.purge" }),
});

export const notesList = defineOperation({
	name: "notes.list",
	kind: "read",
	description: "List notes.",
	input: z.object({}),
	run: (_input, ctx) => notes(ctx).selectFrom("note").selectAll().orderBy("id").execute(),
});

export const notesOpen = defineOperation({
	name: "notes.open",
	kind: "screen",
	description: "Open a note in the editor.",
	input: z.object({ id: z.string() }),
	run: () => undefined,
});

export const noteOperations = [notesCreate, notesEdit, foldersCreate, notesMove, notesPurge, notesList, notesOpen];
