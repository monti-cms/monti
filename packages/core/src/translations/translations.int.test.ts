import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import type { Block, Doc } from "../body/doc";
import { createReader } from "../entries/reader";
import { createMonti } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema, type LocalesDefinition, type Schema } from "../schema/define";
import { readChangeFiles, schemaFilesAt } from "../schema/files";

const db = await testDatabase();

const schema = defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
			{ code: "ja", name: "日本語" },
		],
		prefix: "exceptSource",
	},
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true, from: "title" },
				summary: { kind: "text", locale: "perLocale" },
				subtitle: { kind: "text", locale: "fromSource" },
				format: { kind: "select", options: ["memo", "essay"], required: true },
			},
		},
	},
});
const oneLanguage: Schema = {
	...schema,
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
};

let clock = new Date("2026-10-01T09:00:00Z");
let root = "";
const site = (current: Schema = schema) =>
	createMonti({ db, schema: current, files: root ? schemaFilesAt(root) : null, secret: "s", now: () => clock });
const reader = (current: Schema = schema) => createReader({ db, schema: current, secret: "s", now: () => clock });

const write = async <Output = { id: string }>(name: string, input: unknown, monti = site()) =>
	((await monti.run(name, input, { actor: "admin" })) as { output: Output }).output;
const read = <Output>(name: string, input: unknown, monti = site()) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;

type Got = {
	entry: { id: string; version: number; slug: string; title: string; locale: string; values: Record<string, unknown> };
	entryDoc?: Doc;
	state: string;
	tasks: { code: string; field?: string; block?: string; blocking: boolean }[];
};
const get = async (id: string) => {
	const got = await read<Got & { entry: { doc: Doc | null } }>("entries.get", { id });
	return { ...got, doc: (got.entry.doc ?? { type: "doc", blocks: [] }) as Doc };
};
const version = async (id: string) => (await get(id)).entry.version;

const p = (id: string, text: string): Block => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const code = (id: string, text: string): Block => ({ id, type: "codeBlock", content: [{ type: "text", text }] });
const body = (...blocks: Block[]): Doc => ({ type: "doc", blocks });
const texts = (doc: Doc) =>
	doc.blocks.map((block) => block.content?.map((part) => ("text" in part ? part.text : "")).join(""));

/** A published Korean post with three paragraphs and a code block. */
async function publishedSource(slug = "first-post") {
	const { id } = await write("entries.create", {
		collection: "post",
		title: "첫 번째 글",
		slug,
		values: { summary: "요약", subtitle: "부제", format: "memo" },
		doc: body(p("s1", "하나"), p("s2", "둘"), code("s3", "npm i"), p("s4", "넷")),
	});
	await write("entries.publish", { ids: [id] });
	return id;
}

async function translate(source: string, locale = "en") {
	return (await write("translations.create", { source, locale })).id;
}

/** Saves the source's body and publishes it again. */
async function republish(source: string, doc: Doc) {
	await write("entries.save", { id: source, version: await version(source), doc });
	await write("entries.publish", { ids: [source] });
}

type Marks = { kind: string; block?: string; from: string; before?: Block | null; after?: Block | string | null }[];
const compare = (id: string) =>
	read<{ marks: Marks; pending: number; source: { id: string; doc: Doc } }>("translations.compare", { id });
const marks = async (id: string) =>
	(await compare(id)).marks.map((mark) => `${mark.kind}:${mark.from}`).sort((a, b) => a.localeCompare(b));
const setBlocks = async (id: string, blocks: unknown[]) =>
	write("translations.setBlocks", { id, version: await version(id), blocks });

/** Decides every pending block of a translation: kept in the source's words. */
async function decideAll(id: string) {
	const pending = (await get(id)).doc.blocks.filter((block) => block.link?.state === "pending");
	await setBlocks(
		id,
		pending.map((block) => ({ block: block.id, do: "keepSource" })),
	);
}

beforeEach(async () => {
	clock = new Date("2026-10-01T09:00:00Z");
	root = "";
	await sql`drop view if exists monti_post`.execute(db);
	for (const table of [
		"entries",
		"schema_state",
		"schema_changes",
		"monti_delivery",
		"monti_activity",
		"source_blocks",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("a new translation", () => {
	it("04-1 translations.create makes an entry of the language in the source's group, every block copied as pending with its source block id and hash", async () => {
		const source = await publishedSource();
		const id = await translate(source);
		const { entry, doc } = await get(id);
		const group = await db.selectFrom("entries").select("translation_group").where("id", "in", [source, id]).execute();
		expect(new Set(group.map((row) => row.translation_group)).size).toBe(1);
		expect(entry.locale).toBe("en");
		expect(texts(doc)).toEqual(["하나", "둘", "npm i", "넷"]);
		expect(doc.blocks.map((block) => block.link?.from)).toEqual(["s1", "s2", "s3", "s4"]);
		// New ids: a translation's blocks are its own.
		expect(doc.blocks.map((block) => block.id)).not.toContain("s1");
		expect(doc.blocks[0]?.link).toMatchObject({ state: "pending", seen: expect.any(String) });
	});

	it("04-1 a block with no text to translate (code) starts as followSource", async () => {
		const id = await translate(await publishedSource());
		expect((await get(id)).doc.blocks.map((block) => block.link?.state)).toEqual([
			"pending",
			"pending",
			"followSource",
			"pending",
		]);
	});

	it("04-1 the new translation starts from the source's address, and its per-language fields are empty", async () => {
		const id = await translate(await publishedSource());
		const { entry } = await get(id);
		expect(entry.slug).toBe("first-post");
		expect(entry.title).toBe("");
		expect(entry.values.summary).toBeUndefined();
		// `fromSource` starts as the source's value; `same` is never stored on a translation.
		expect(entry.values.subtitle).toBe("부제");
		expect(entry.values.format).toBeUndefined();
	});

	it("04-1 translations.create refuses a language the site does not have, the source language, and one the group has", async () => {
		const source = await publishedSource();
		await expect(write("translations.create", { source, locale: "fr" })).rejects.toMatchObject({
			reason: { key: "translations.unknownLocale" },
		});
		await expect(write("translations.create", { source, locale: "ko" })).rejects.toMatchObject({
			reason: { key: "translations.unknownLocale" },
		});
		await translate(source);
		await expect(write("translations.create", { source, locale: "en" })).rejects.toMatchObject({
			reason: { key: "translations.exists" },
		});
	});

	it("04-1 translations.create from a translation is refused: a translation is made from the source", async () => {
		const english = await translate(await publishedSource());
		await expect(write("translations.create", { source: english, locale: "ja" })).rejects.toMatchObject({
			reason: { key: "translations.notSource" },
		});
	});

	it("04-1 translations.setBlocks keeps a pending block in the source's words, or removes it", async () => {
		const id = await translate(await publishedSource());
		const [first, second] = (await get(id)).doc.blocks;
		await setBlocks(id, [
			{ block: first?.id, do: "keepSource" },
			{ block: second?.id, do: "remove" },
		]);
		const { doc } = await get(id);
		expect(texts(doc)).toEqual(["하나", "npm i", "넷"]);
		expect(doc.blocks[0]?.link?.state).toBe("keepSource");
		// The removed block's source is not offered again as new.
		expect(await marks(id)).toEqual([]);
	});

	it("04-1 typing into a pending block and saving makes it translated", async () => {
		const id = await translate(await publishedSource());
		const { doc } = await get(id);
		const [first, ...rest] = doc.blocks;
		await write("entries.save", { id, version: await version(id), doc: body(p(first?.id ?? "", "One"), ...rest) });
		const saved = (await get(id)).doc.blocks;
		expect(saved[0]?.link).toMatchObject({ from: "s1", state: "translated" });
		expect(saved[1]?.link?.state).toBe("pending");
	});

	it("04-1 a save cannot forge or change a link: the core keeps them", async () => {
		const id = await translate(await publishedSource());
		const { doc } = await get(id);
		const forged = doc.blocks.map((block) => ({ ...block, link: { from: "s1", seen: "x", state: "translated" } }));
		await write("entries.save", { id, version: await version(id), doc: { type: "doc", blocks: forged } });
		expect((await get(id)).doc.blocks.map((block) => block.link?.from)).toEqual(["s1", "s2", "s3", "s4"]);
		expect((await get(id)).doc.blocks[0]?.link?.state).toBe("pending");
	});

	it("04-1 a body.edit on a translated block marks it translated against the source block as it is now", async () => {
		const source = await publishedSource();
		const id = await translate(source);
		const first = (await get(id)).doc.blocks[0]?.id ?? "";
		await write("body.edit", {
			id,
			version: await version(id),
			ops: [{ op: "replaceText", block: first, from: 0, to: 2, text: "One" }],
		});
		expect((await get(id)).doc.blocks[0]?.link?.state).toBe("translated");
	});

	it("04-1 'only in this language' makes a followSource block translated, and the site then shows the translation's own block", async () => {
		const source = await publishedSource();
		const id = await translate(source);
		const codeBlock = (await get(id)).doc.blocks[2] as Block;
		await setBlocks(id, [{ block: codeBlock.id, do: "detach" }]);
		const { doc } = await get(id);
		expect(doc.blocks[2]?.link?.state).toBe("translated");
		await write("entries.save", {
			id,
			version: await version(id),
			title: "First post",
			values: { summary: "Summary" },
			doc: {
				...doc,
				blocks: doc.blocks.map((block) => (block.id === codeBlock.id ? code(block.id, "pnpm i") : block)),
			},
		});
		await decideAll(id);
		await write("entries.publish", { ids: [id] });
		const found = await reader().entry({ collection: "post", locale: "en", slug: "first-post" });
		expect(found && "entry" in found && texts(found.entry.doc as Doc)).toEqual(["하나", "둘", "pnpm i", "넷"]);
	});
});

describe("pending blocks", () => {
	it("04-3 a translation with pending blocks cannot be published; its to-do list names each pending block", async () => {
		const id = await translate(await publishedSource());
		await write("entries.save", { id, version: await version(id), title: "First post" });
		const { tasks, doc } = await get(id);
		const pending = doc.blocks.filter((block) => block.link?.state === "pending").map((block) => block.id);
		expect(tasks.filter((task) => task.code === "pending")).toEqual(
			pending.map((block) => expect.objectContaining({ field: "doc", block, blocking: true })),
		);
		await expect(write("entries.publish", { ids: [id] })).rejects.toMatchObject({
			reason: { key: "entries.publishBlocked", values: { count: 3 } },
		});
	});

	it("04-3 once every pending block is decided, the translation publishes under its language", async () => {
		const id = await translate(await publishedSource());
		await write("entries.save", { id, version: await version(id), title: "First post" });
		await decideAll(id);
		await write("entries.publish", { ids: [id] });
		expect((await get(id)).state).toBe("published");
		const found = await reader().entry({ collection: "post", locale: "en", slug: "first-post" });
		expect(found && "entry" in found && found.entry.title).toBe("First post");
	});

	it("04-3 the site never draws a pending block, even in a preview", async () => {
		const id = await translate(await publishedSource());
		const { doc } = await get(id);
		await write("entries.save", {
			id,
			version: await version(id),
			title: "First post",
			doc: { ...doc, blocks: [p(doc.blocks[0]?.id ?? "", "One"), ...doc.blocks.slice(1)] },
		});
		const { token } = await read<{ token: string }>("entries.previewLink", { id });
		const found = await reader().entry({ collection: "post", locale: "en", slug: "first-post", preview: token });
		expect(found && "entry" in found && texts(found.entry.doc as Doc)).toEqual(["One", "npm i"]);
	});
});

describe("when the source changes", () => {
	async function publishedPair() {
		const source = await publishedSource();
		const id = await translate(source);
		await write("entries.save", { id, version: await version(id), title: "First post" });
		await decideAll(id);
		await write("entries.publish", { ids: [id] });
		return { source, id };
	}

	it("04-2 saving the source without publishing it marks nothing in its translations", async () => {
		const { source, id } = await publishedPair();
		await write("entries.save", {
			id: source,
			version: await version(source),
			doc: body(p("s1", "하나!"), p("s4", "넷")),
		});
		expect(await marks(id)).toEqual([]);
	});

	it("04-2 publishing the source again marks exactly the blocks that changed, the ones removed and the ones added", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나!"), p("s2", "둘"), code("s3", "npm i"), p("s5", "다섯")));
		expect(await marks(id)).toEqual(["added:s5", "changed:s1", "removed:s4"]);
	});

	it("04-2 a changed source block the translation follows (code) is no mark, in compare and in the counts alike", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나"), p("s2", "둘"), code("s3", "pnpm i"), p("s4", "넷")));
		expect(await marks(id)).toEqual([]);
		const { groups } = await read<Status>("translations.status", { ids: [id] });
		expect(groups[0]?.locales.find((locale) => locale.id === id)?.changes).toBe(0);
	});

	it("04-2 translations.compare gives each changed block the source before and after", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나!"), p("s2", "둘"), code("s3", "npm i"), p("s4", "넷")));
		const [mark] = (await compare(id)).marks;
		expect(mark).toMatchObject({ kind: "changed", from: "s1" });
		expect(texts(body(mark?.before as Block, mark?.after as Block))).toEqual(["하나", "하나!"]);
	});

	it("04-2 confirming a changed block clears its mark and keeps its text", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나!"), p("s2", "둘"), code("s3", "npm i"), p("s4", "넷")));
		const block = (await compare(id)).marks[0]?.block;
		await setBlocks(id, [{ block, do: "confirm" }]);
		expect(await marks(id)).toEqual([]);
		expect(texts((await get(id)).doc)[0]).toBe("하나");
	});

	it("04-2 a body.edit re-translation of a changed block clears its mark", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나!"), p("s2", "둘"), code("s3", "npm i"), p("s4", "넷")));
		const block = (await compare(id)).marks[0]?.block ?? "";
		await write("body.edit", {
			id,
			version: await version(id),
			ops: [{ op: "replaceText", block, from: 0, to: 2, text: "One!" }],
		});
		expect(await marks(id)).toEqual([]);
	});

	it("04-2 a removed mark is confirmed (the block stays, unpaired) or the block is removed", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(code("s3", "npm i")));
		const removed = (await compare(id)).marks.filter((mark) => mark.kind === "removed");
		expect(removed.map((mark) => mark.from)).toEqual(["s1", "s2", "s4"]);
		await setBlocks(id, [
			{ block: removed[0]?.block, do: "confirm" },
			{ block: removed[1]?.block, do: "remove" },
		]);
		expect(await marks(id)).toEqual(["removed:s4"]);
		const { doc } = await get(id);
		expect(texts(doc)).toEqual(["하나", "npm i", "넷"]);
		expect(doc.blocks[0]?.link).toBeUndefined();
	});

	it("04-2 an added source block goes in as a pending block, kept in the source's words, or left out for good", async () => {
		const { source, id } = await publishedPair();
		await republish(
			source,
			body(p("s0", "영"), p("s1", "하나"), p("s2", "둘"), code("s3", "npm i"), p("s4", "넷"), p("s5", "다섯")),
		);
		const added = (await compare(id)).marks.filter((mark) => mark.kind === "added");
		expect(added.map((mark) => [mark.from, mark.after === null])).toEqual([
			["s0", true],
			["s5", false],
		]);
		await setBlocks(id, [
			{ from: "s0", do: "add" },
			{ from: "s5", do: "skip" },
		]);
		const { doc } = await get(id);
		expect(texts(doc)[0]).toBe("영");
		expect(doc.blocks[0]?.link).toMatchObject({ from: "s0", state: "pending" });
		expect(await marks(id)).toEqual([]);
	});

	it("04-2 translations.confirmAll clears changed and removed marks, and leaves added blocks to be decided", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나!"), p("s2", "둘?"), code("s3", "npm i"), p("s5", "다섯")));
		await write("translations.confirmAll", { id, version: await version(id) });
		expect(await marks(id)).toEqual(["added:s5"]);
	});

	it("04-2 publishing the source back to what the translation saw clears the marks again", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나!"), p("s2", "둘"), code("s3", "npm i"), p("s4", "넷")));
		expect(await marks(id)).toEqual(["changed:s1"]);
		await republish(source, body(p("s1", "하나"), p("s2", "둘"), code("s3", "npm i"), p("s4", "넷")));
		expect(await marks(id)).toEqual([]);
	});

	it("04-2 a published translation stays published while its source changes", async () => {
		const { source, id } = await publishedPair();
		await republish(source, body(p("s1", "하나!")));
		expect((await get(id)).state).toBe("published");
	});
});

type Status = {
	groups: {
		group: string;
		source: string | null;
		locales: { locale: string; id: string; state: string; changes: number; pending: number }[];
		missing: string[];
	}[];
};

describe("translation status", () => {
	it("04-4 translations.status gives each group's languages with their state, their source changes and their pending blocks", async () => {
		const source = await publishedSource();
		const english = await translate(source);
		const { groups } = await read<Status>("translations.status", { ids: [english] });
		expect(groups).toEqual([
			{
				group: expect.any(String),
				source,
				locales: [
					{ locale: "ko", id: source, state: "published", changes: 0, pending: 0 },
					{ locale: "en", id: english, state: "draft", changes: 0, pending: 3 },
				],
				missing: ["ja"],
			},
		]);
	});

	it("04-4 the list's translation filters and facets (missing, source changed, up to date) count the same groups translations.status reports", async () => {
		// Three groups: one changed in English, one up to date in English, one with no translation.
		const changed = await publishedSource();
		const changedEnglish = await translate(changed);
		await republish(changed, body(p("s1", "바뀜")));
		const upToDate = await publishedSource("second-post");
		await translate(upToDate);
		const { id: alone } = await write("entries.create", { collection: "post", title: "셋째", slug: "third" });

		const { groups } = await read<Status>("translations.status", { ids: [changed, upToDate, alone] });
		const english = (group: Status["groups"][number]) => group.locales.find((locale) => locale.locale === "en");
		const byStatus = {
			missing: groups.filter((group) => group.missing.includes("en")).map((group) => group.source),
			sourceChanged: groups.filter((group) => (english(group)?.changes ?? 0) > 0).map((group) => group.source),
			upToDate: groups.filter((group) => english(group) && english(group)?.changes === 0).map((group) => group.source),
		};
		expect(byStatus).toEqual({ missing: [alone], sourceChanged: [changed], upToDate: [upToDate] });
		expect(
			groups.find((group) => group.source === changed)?.locales.find((l) => l.id === changedEnglish)?.changes,
		).toBe(4);

		const query = (is: string) =>
			read<{ rows: { id: string }[] }>("entries.query", {
				collection: "post",
				filters: [{ on: "translation", is, locales: ["en"] }],
			});
		for (const [is, ids] of Object.entries(byStatus)) expect((await query(is)).rows.map((row) => row.id)).toEqual(ids);
		const { values } = await read<{ values: { value: string; count: number }[] }>("entries.facets", {
			collection: "post",
			column: "translation",
			filters: [{ on: "locale", any: ["ko"] }],
		});
		expect(values).toEqual([
			{ value: "missing", count: 3 },
			{ value: "sourceChanged", count: 1 },
			{ value: "upToDate", count: 0 },
		]);
	});

	it("T52 the list row of a group is its source-language entry, whichever was made first", async () => {
		const source = await publishedSource();
		const english = await translate(source);
		// The translation made earlier than its source, as an import may leave it.
		await sql`update entries set created_at = created_at - interval '1 day' where id = ${english}`.execute(db);
		const { rows } = await read<{ rows: { id: string; locale: string; locales: string[] }[] }>("entries.query", {
			collection: "post",
		});
		expect(rows).toEqual([expect.objectContaining({ id: source, locale: "ko", locales: ["ko", "en"] })]);
	});

	it("T52 the list has a language column only when the site has more than one language", async () => {
		const ids = async (monti: ReturnType<typeof site>) =>
			(await read<{ columns: { id: string }[] }>("list.columns", { collection: "post" }, monti)).columns.map(
				(column) => column.id,
			);
		expect(await ids(site())).toContain("locale");
		expect(await ids(site(oneLanguage))).not.toContain("locale");
	});
});

describe("field values in a translation", () => {
	it("04-5 a 'same' field reads the source's value, and a translation cannot save its own", async () => {
		const id = await translate(await publishedSource());
		await expect(
			write("entries.save", { id, version: await version(id), values: { format: "essay" } }),
		).rejects.toMatchObject({
			reason: { key: "entries.sameField", values: { field: "format" } },
		});
	});

	it("04-5 the site reads a published translation's fields by the same rules", async () => {
		const source = await publishedSource();
		const id = await translate(source);
		await write("entries.save", {
			id,
			version: await version(id),
			title: "First post",
			values: { summary: "Summary", subtitle: null },
		});
		await decideAll(id);
		await write("entries.publish", { ids: [id] });
		const found = await reader().entry({ collection: "post", locale: "en", slug: "first-post" });
		// `same` from the source, `fromSource` from the source while the translation's is empty, `perLocale` its own.
		expect(found && "entry" in found && found.entry.values).toEqual({
			summary: "Summary",
			subtitle: "부제",
			format: "memo",
		});
	});

	it("04-5 the publish to-do list of a translation checks a required 'same' field on the source", async () => {
		const { id: source } = await write("entries.create", { collection: "post", title: "글", slug: "post" });
		const id = await translate(source);
		await write("entries.save", { id, version: await version(id), title: "Post" });
		expect((await get(id)).tasks.filter((task) => task.code === "required").map((task) => task.field)).toEqual([
			"format",
		]);
		await write("entries.save", { id: source, version: await version(source), values: { format: "memo" } });
		expect((await get(id)).tasks.filter((task) => task.code === "required")).toEqual([]);
	});
});

describe("creating entries", () => {
	it("T26 entries.create takes only the site's source language, by default the source language", async () => {
		const { id } = await write("entries.create", { collection: "post" });
		expect((await get(id)).entry.locale).toBe("ko");
		for (const locale of ["en", "fr"])
			await expect(write("entries.create", { collection: "post", locale })).rejects.toMatchObject({
				reason: { key: "entries.notSourceLocale" },
			});
	});

	it("T26 entries.duplicate copies only a source-language entry", async () => {
		const english = await translate(await publishedSource());
		await expect(write("entries.duplicate", { id: english })).rejects.toMatchObject({
			reason: { key: "entries.duplicateTranslation" },
		});
	});
});

describe("the site's languages", () => {
	const locales = (change: Partial<LocalesDefinition>): LocalesDefinition => ({ ...schema.locales, ...change });
	type Plan = {
		problems: { code: string }[];
		changes: { do: string; locale?: string; count?: number; choices?: unknown[] }[];
	};
	const plan = (next: LocalesDefinition) => read<Plan>("locales.plan", { locales: next });

	it("04-6 the schema's languages are checked: a known source, codes once each, at least one", async () => {
		const problems = async (next: LocalesDefinition) => (await plan(next)).problems.map((problem) => problem.code);
		expect(await problems(locales({ source: "fr" }))).toEqual(["unknownSource"]);
		expect(await problems(locales({ list: [...schema.locales.list, { code: "en", name: "English" }] }))).toEqual([
			"duplicateLocale",
		]);
		expect(await problems(locales({ list: [{ code: "Korean!", name: "x" }], source: "Korean!" }))).toEqual([
			"badLocale",
		]);
		expect(await problems(locales({ list: [] }))).toEqual(["noLocales"]);
	});

	it("04-6 locales.plan lists the languages added and removed and a source change, with the translations each touches", async () => {
		await translate(await publishedSource());
		const { changes } = await plan({
			source: "en",
			list: [
				{ code: "en", name: "English" },
				{ code: "ko", name: "한국어" },
				{ code: "fr", name: "Français" },
			],
			prefix: "exceptSource",
		});
		expect(changes).toEqual([
			{ id: "addLocale:fr", do: "addLocale", locale: "fr" },
			{
				id: "removeLocale:ja",
				do: "removeLocale",
				locale: "ja",
				count: 0,
				choices: [{ do: "removeLocale", confirm: true }],
			},
			{ id: "changeSource", do: "changeSource", from: "ko", locale: "en", count: 0 },
		]);
	});

	async function onDevServer() {
		root = await mkdtemp(path.join(tmpdir(), "monti-locales-"));
	}
	const apply = (next: LocalesDefinition, answers: Record<string, unknown> = {}) =>
		write<{ applied: boolean }>("locales.apply", { locales: next, answers });

	it("04-6 adding a language changes no entry", async () => {
		await onDevServer();
		const source = await publishedSource();
		const before = await version(source);
		await apply(locales({ list: [...schema.locales.list, { code: "fr", name: "Français" }] }));
		expect(await version(source)).toBe(before);
		expect(await readFile(path.join(root, "monti.schema.ts"), "utf8")).toContain('code: "fr"');
	});

	it("04-6 removing a language with translations deletes them after the review's 'delete and apply'", async () => {
		await onDevServer();
		const english = await translate(await publishedSource());
		const next = locales({ list: schema.locales.list.filter((locale) => locale.code !== "en") });
		await expect(apply(next)).rejects.toMatchObject({ reason: { key: "schema.choicesMissing" } });
		await apply(next, { "removeLocale:en": { do: "removeLocale", confirm: true } });
		expect(await db.selectFrom("entries").select("id").where("id", "=", english).execute()).toEqual([]);
	});

	it("04-6 a new source language with an entry in a group makes that entry the source and pairs the blocks again", async () => {
		await onDevServer();
		const korean = await publishedSource();
		const english = await translate(korean);
		const japanese = await translate(korean, "ja");
		await apply(locales({ source: "en" }));
		const englishBlocks = (await get(english)).doc.blocks;
		const koreanBlocks = (await get(korean)).doc.blocks;
		// The Korean blocks now point at the English ones, and so do the Japanese.
		expect(koreanBlocks.map((block) => block.link?.from)).toEqual(englishBlocks.map((block) => block.id));
		expect((await get(japanese)).doc.blocks.map((block) => block.link?.from)).toEqual(
			englishBlocks.map((block) => block.id),
		);
		const { groups } = await read<Status>(
			"translations.status",
			{ ids: [korean] },
			site({ ...schema, locales: locales({ source: "en" }) }),
		);
		expect(groups[0]?.source).toBe(english);
	});

	it("04-6 a new source language without an entry in a group gets a draft of pending blocks copied from the old source", async () => {
		await onDevServer();
		const korean = await publishedSource();
		await apply(locales({ source: "en" }));
		const { groups } = await read<Status>(
			"translations.status",
			{ ids: [korean] },
			site({ ...schema, locales: locales({ source: "en" }) }),
		);
		const english = groups[0]?.locales.find((locale) => locale.locale === "en");
		expect(english).toMatchObject({ state: "draft", pending: 3 });
		const { doc, entry } = await get(english?.id ?? "");
		expect(texts(doc)).toEqual(["하나", "둘", "npm i", "넷"]);
		expect(entry.values.format).toBe("memo");
	});

	it("04-6 after a source change every published entry is still published as it was", async () => {
		await onDevServer();
		const korean = await publishedSource();
		await apply(locales({ source: "en" }));
		expect((await get(korean)).state).toBe("published");
		const found = await reader({ ...schema, locales: locales({ source: "en" }) }).entry({
			collection: "post",
			locale: "ko",
			slug: "first-post",
		});
		expect(found && "entry" in found && texts(found.entry.doc as Doc)).toEqual(["하나", "둘", "npm i", "넷"]);
	});

	it("04-6 locales.apply is a structure change: it writes the file and a change file, and the live site has no way to run it", async () => {
		await expect(apply(locales({ prefix: "always" }))).rejects.toThrow();
		await onDevServer();
		await apply(locales({ list: [...schema.locales.list, { code: "fr", name: "Français" }] }));
		expect((await readChangeFiles(path.join(root, "monti", "changes"))).length).toBe(1);
	});
});
