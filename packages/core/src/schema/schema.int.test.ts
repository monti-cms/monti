import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { agentTools, callAgentTool } from "../entry/tools";
import { createMonti } from "../monti";
import { migrateContent, readSchemaState } from "./apply";
import { defineSchema, type Schema } from "./define";
import { readChangeFiles, schemaFilesAt } from "./files";
import { syncSchemaFile } from "./sync";

const db = await testDatabase();

const base = defineSchema({
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true, locale: "perLocale" },
				slug: { kind: "slug", required: true, locale: "fromSource", from: "title" },
				summary: { kind: "text", max: 120 },
				subtitle: { kind: "text" },
			},
		},
		memo: {
			kind: "document",
			path: "/memos/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

/** `base` with its post fields replaced. */
const withPostFields = (fields: Schema["collections"][string]["fields"]): Schema => ({
	collections: { ...base.collections, post: { ...base.collections.post, fields } },
});
const { title, slug } = base.collections.post.fields;
// summary → excerpt, subtitle removed, a new required `format`.
const edited = withPostFields({
	title,
	slug,
	excerpt: { kind: "text", max: 120 },
	format: { kind: "select", options: ["memo", "essay"], required: true },
});
const renames = [{ collection: "post", from: "summary", to: "excerpt" }];

let root: string;
const dev = (schema: Schema = base) => createMonti({ db, schema, files: schemaFilesAt(root) });
const live = (schema: Schema = base) => createMonti({ db, schema, files: null });
const api = (monti: ReturnType<typeof createMonti>) => signedInApi(monti);
const post = (name: string, input: unknown) =>
	new Request(`https://site.test/api/operations/${name}`, { method: "POST", body: JSON.stringify({ input }) });

async function addEntry(collection: string, values: Record<string, unknown>) {
	await db
		.insertInto("entries")
		.values({
			id: randomUUID(),
			collection,
			translation_group: randomUUID(),
			locale: "ko",
			slug: randomUUID(),
			values: JSON.stringify(values),
		})
		.execute();
}
const postValues = async () =>
	(
		await db.selectFrom("entries").select("values").where("collection", "=", "post").orderBy("created_at").execute()
	).map((row) => row.values);

beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), "monti-schema-"));
	await sql`drop view if exists monti_post, monti_memo`.execute(db);
	for (const table of [
		"entries",
		"schema_state",
		"schema_changes",
		"collection_admin_values",
		"monti_activity",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, base, []);
	await addEntry("post", { summary: "first", subtitle: "sub" });
	await addEntry("post", { summary: "second" });
});

const reviewAnswers = {
	"renameField:post.summary": { do: "renameField", values: "move" },
	"removeField:post.subtitle": { do: "removeField", values: "clear" },
	"addField:post.format": { do: "addRequiredField", fill: "memo" },
} as const;

describe("one change file, two ways in, one way to apply", () => {
	it("01-1 an admin save and a hand edit leave the same change steps, and the live database follows them to the same values", async () => {
		const applied = (await dev().run(
			"schema.apply",
			{ draft: edited, renames, answers: reviewAnswers },
			{ actor: "admin" },
		)) as { output: { applied: boolean } };
		expect(applied.output.applied).toBe(true);
		const [change] = await readChangeFiles(path.join(root, "monti", "changes"));
		expect(await readFile(path.join(root, "monti.schema.ts"), "utf8")).toContain("excerpt");
		const devValues = await postValues();
		expect(devValues).toEqual([
			{ excerpt: "first", format: "memo" },
			{ excerpt: "second", format: "memo" },
		]);

		// The live database, at the old schema with the same entries, deploys: it follows the change file.
		await db.deleteFrom("schema_changes").execute();
		await db.deleteFrom("entries").execute();
		await migrateContent(db, base, []);
		await addEntry("post", { summary: "first", subtitle: "sub" });
		await addEntry("post", { summary: "second" });
		expect(await migrateContent(db, edited, [change])).toEqual([change.id]);
		expect(await postValues()).toEqual(devValues);
		expect((await readSchemaState(db))?.schema).toEqual(edited);
	});

	it("01-1 a hand edit that touches no stored value gets its change file and is applied; one that does waits for the review", async () => {
		const added = withPostFields({ ...base.collections.post.fields, cover: { kind: "media", accept: "image" } });
		const result = await syncSchemaFile(dev(added));
		expect(result.status).toBe("applied");
		expect(await readdir(path.join(root, "monti", "changes"))).toHaveLength(1);
		// The file a developer wrote is theirs: the admin does not rewrite it.
		await expect(readFile(path.join(root, "monti.schema.ts"), "utf8")).rejects.toThrow();

		const review = await syncSchemaFile(dev(withPostFields({ title, slug, cover: { kind: "media" } })));
		expect(review.status).toBe("review");
		expect((await readSchemaState(db))?.schema).toEqual(added);
	});
});

describe("plans", () => {
	it("01-4 a field whose keys come back from the database in another order is no change", async () => {
		const { summary, ...rest } = base.collections.post.fields;
		const reordered = withPostFields({ ...rest, summary: { max: 120, kind: "text" } as typeof summary });
		const planned = (await dev().run("schema.plan", { draft: reordered }, { actor: "admin" })) as {
			changes: unknown[];
		};
		expect(planned.changes).toEqual([]);
	});
});

describe("the live site", () => {
	it("01-3 no entry point changes structure on the live site, and admin values still save", async () => {
		const monti = live();
		expect((await api(monti)(post("schema.apply", { draft: edited, renames, answers: reviewAnswers }))).status).toBe(
			403,
		);
		await expect(monti.run("schema.retry", {}, { actor: "cli" })).rejects.toThrow("Not allowed");
		expect(agentTools(monti).map((tool) => tool.name)).not.toContain("schema.apply");
		const capabilities = (await monti.run("meta.capabilities", {}, { actor: "admin" })) as { name: string }[];
		expect(capabilities.map((capability) => capability.name)).not.toContain("schema.apply");
		expect((await readSchemaState(db))?.schema).toEqual(base);

		const saved = await api(monti)(
			post("collections.updateAdminValues", {
				collection: "post",
				values: { label: "게시글", fields: { summary: { description: "One sentence, conclusion first." } } },
			}),
		);
		expect(saved.status).toBe(200);
		const read = (await monti.run("schema.read", {}, { actor: "assistant" })) as {
			adminValues: Record<string, { fields: Record<string, { description: string }> }>;
			locked: boolean;
		};
		expect(read.locked).toBe(true);
		expect(read.adminValues.post.fields.summary.description).toBe("One sentence, conclusion first.");
	});
});

describe("review before values change", () => {
	it("01-4 a change that touches stored values is refused until each choice is made, and nothing is written", async () => {
		const monti = dev();
		const plan = (await monti.run("schema.plan", { draft: edited, renames }, { actor: "admin" })) as {
			changes: { id: string; count?: number; choices?: unknown[] }[];
		};
		expect(plan.changes.filter((change) => change.choices).map((change) => [change.id, change.count])).toEqual([
			["renameField:post.summary", 2],
			["removeField:post.subtitle", 1],
			["addField:post.format", 2],
		]);

		const { "addField:post.format": _left, ...partial } = reviewAnswers;
		await expect(
			monti.run("schema.apply", { draft: edited, renames, answers: partial }, { actor: "admin" }),
		).rejects.toThrow("Check failed");
		await expect(readdir(path.join(root, "monti"))).rejects.toThrow();
		expect(await postValues()).toEqual([{ summary: "first", subtitle: "sub" }, { summary: "second" }]);
	});

	it("01-4 a schema with something to fix cannot be applied", async () => {
		const broken = withPostFields({ title, slug, format: { kind: "select", options: [] } });
		expect(await dev().run("schema.check", { draft: broken }, { actor: "admin" })).toEqual([
			{ collection: "post", field: "format", code: "noOptions" },
		]);
		await expect(dev().run("schema.apply", { draft: broken }, { actor: "admin" })).rejects.toThrow("Check failed");
	});

	it("01-4 the title and the slug, every collection's fixed fields, are always required", async () => {
		const optional = withPostFields({ title: { ...title, required: false }, slug: { kind: "slug" } });
		expect(await dev().run("schema.check", { draft: optional }, { actor: "admin" })).toEqual([
			{ collection: "post", field: "title", code: "fixedOptional" },
			{ collection: "post", field: "slug", code: "fixedOptional" },
		]);
	});
});

describe("removing a collection", () => {
	it("01-4 removing a collection waits for the delete-and-apply answer, then deletes its entries; a relation still pointing at it must be fixed first", async () => {
		await addEntry("memo", {});
		const { memo: _memo, ...rest } = base.collections;
		const withoutMemo = { collections: rest };
		await expect(dev().run("schema.apply", { draft: withoutMemo }, { actor: "admin" })).rejects.toThrow("Check failed");
		const pointing = {
			collections: {
				post: {
					...base.collections.post,
					fields: { ...base.collections.post.fields, memo: { kind: "relation", to: "memo" } },
				},
			},
		} as Schema;
		expect(await dev().run("schema.check", { draft: pointing }, { actor: "admin" })).toEqual([
			{ collection: "post", field: "memo", code: "unknownTarget" },
		]);

		await dev().run(
			"schema.apply",
			{ draft: withoutMemo, answers: { "removeCollection:memo": { do: "removeCollection", confirm: true } } },
			{ actor: "admin" },
		);
		expect(await db.selectFrom("entries").select("id").where("collection", "=", "memo").execute()).toEqual([]);
		expect(await postValues()).toHaveLength(2);
	});
});

describe("removing a field", () => {
	const removed = withPostFields({ title, slug, summary: base.collections.post.fields.summary });

	it("01-4 the review asks about every change that can touch live values, even when the dev data has none", async () => {
		await db.deleteFrom("entries").execute();
		const plan = (await dev().run("schema.plan", { draft: edited, renames }, { actor: "admin" })) as {
			changes: { id: string; count?: number; choices?: unknown[] }[];
		};
		expect(plan.changes.filter((change) => change.choices).map((change) => [change.id, change.count])).toEqual([
			["renameField:post.summary", 0],
			["removeField:post.subtitle", 0],
			["addField:post.format", 0],
		]);
		await expect(dev().run("schema.apply", { draft: removed }, { actor: "admin" })).rejects.toThrow("Check failed");
		expect((await syncSchemaFile(dev(removed))).status).toBe("review");
	});

	it("01-5 a removed field's values go with it, unless they are moved to another field", async () => {
		await dev().run(
			"schema.apply",
			{ draft: removed, answers: { "removeField:post.subtitle": { do: "removeField", values: "clear" } } },
			{ actor: "admin" },
		);
		expect(await postValues()).toEqual([{ summary: "first" }, { summary: "second" }]);
		// A new field by the old name starts empty: nothing was kept.
		await dev(removed).run("schema.apply", { draft: base }, { actor: "admin" });
		expect((await postValues())[0]).toEqual({ summary: "first" });
	});

	it("01-5 a renamed field keeps its label and its place in the layout; a removed field's admin values go with it", async () => {
		await db
			.insertInto("collection_admin_values")
			.values({
				collection: "post",
				values: JSON.stringify({
					label: "글",
					fields: { summary: { label: "요약" }, subtitle: { label: "부제" } },
					layout: [{ tab: "기본", fields: ["title", "subtitle", { group: "더", fields: ["summary"] }] }],
				}),
			})
			.execute();
		await dev().run("schema.apply", { draft: edited, renames, answers: reviewAnswers }, { actor: "admin" });
		const row = await db
			.selectFrom("collection_admin_values")
			.select("values")
			.where("collection", "=", "post")
			.executeTakeFirstOrThrow();
		expect(row.values).toEqual({
			label: "글",
			fields: { excerpt: { label: "요약" } },
			layout: [{ tab: "기본", fields: ["title", { group: "더", fields: ["excerpt"] }] }],
		});
	});

	it("01-5 moving keeps the values in the other field, without overwriting what it has", async () => {
		await addEntry("post", { subtitle: "moved" });
		await dev().run(
			"schema.apply",
			{ draft: removed, answers: { "removeField:post.subtitle": { do: "removeField", values: { move: "summary" } } } },
			{ actor: "admin" },
		);
		// The first entry's subtitle ("sub") does not overwrite its summary; the third's moves into an empty one.
		expect(await postValues()).toEqual([{ summary: "first" }, { summary: "second" }, { summary: "moved" }]);
	});
});

describe("the assistant", () => {
	it("01-6 an assistant schema change is a proposal: nothing is written until it is applied, and applying needs the same answers", async () => {
		const monti = dev();
		const proposalId = await monti.proposals.create("c1", "add a cover image");
		const withCover = withPostFields({ ...base.collections.post.fields, cover: { kind: "media" } });
		await callAgentTool(monti, "schema.apply", { draft: withCover }, { conversationId: "c1", proposalId });
		await expect(readdir(path.join(root, "monti"))).rejects.toThrow();

		// Proposing runs the same check, so a change with values to decide is refused before it reaches the review.
		const removeSubtitle = withPostFields({ title, slug, summary: base.collections.post.fields.summary });
		await expect(
			callAgentTool(monti, "schema.apply", { draft: removeSubtitle }, { conversationId: "c1", proposalId }),
		).rejects.toThrow("Check failed");

		const [item] = await monti.proposals.apply(proposalId);
		expect(item.state).toBe("applied");
		expect((await readSchemaState(db))?.schema).toEqual(withCover);
	});
});

describe("a failed apply", () => {
	it("01-7 when the database step fails, the files stay saved and 다시 적용 finishes it", async () => {
		await sql`create function refuse() returns trigger language plpgsql as $$ begin raise exception 'refused'; end $$`.execute(
			db,
		);
		await sql`create trigger refuse before update on entries for each row execute function refuse()`.execute(db);
		const monti = dev();
		const result = (await monti.run(
			"schema.apply",
			{ draft: edited, renames, answers: reviewAnswers },
			{ actor: "admin" },
		)) as { output: { applied: boolean; changeId: string } };
		expect(result.output.applied).toBe(false);
		expect(await readdir(path.join(root, "monti", "changes"))).toEqual([`${result.output.changeId}.json`]);
		const read = (await monti.run("schema.read", {}, { actor: "admin" })) as { failedChange: string | null };
		expect(read.failedChange).toBe(result.output.changeId);
		expect(await postValues()).toEqual([{ summary: "first", subtitle: "sub" }, { summary: "second" }]);

		await sql`drop trigger refuse on entries`.execute(db);
		await sql`drop function refuse`.execute(db);
		await monti.run("schema.retry", {}, { actor: "admin" });
		expect((await postValues())[0]).toEqual({ excerpt: "first", format: "memo" });
		expect((await monti.run("schema.read", {}, { actor: "admin" })) as { failedChange: null }).toMatchObject({
			failedChange: null,
			fileChanged: false,
		});
	});
});
