import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { MontiConfig, Schema } from "../../engine/types";
import type { Block } from "../../rich-text/types";
import { entries } from "../entries/entries";
import { translationStatus } from "./translation-status";

let testDb: TestDatabase;
let db: Kysely<Database>;

const POSTS = "posts";
const NOTES = "notes";

/** `posts` has a body and two text fields; `notes` has the same fields and no body. */
const SCHEMA: Schema = {
	locales: ["ko", "en", "ja"],
	collections: {
		[POSTS]: { body: true, fields: { title: { type: "text" }, summary: { type: "text" } } },
		[NOTES]: { fields: { title: { type: "text" }, summary: { type: "text" } } },
	},
};

const CONFIG: MontiConfig = { name: "Monti Blog", dev: false };

/** The source fields most tests start from. */
const FIELDS = { title: "제목", summary: "요약" };

function montiOf() {
	return createMonti(db, { entries, translationStatus }, [], {
		schema: SCHEMA,
		config: CONFIG,
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
});

afterEach(async () => {
	await testDb.drop();
});

function paragraph(id: string, text: string): Block {
	return { id, type: "paragraph", content: [{ type: "text", text }] };
}

function quote(id: string, children: Block[]): Block {
	return { id, type: "quote", children };
}

interface DataSeed {
	fields?: Record<string, unknown>;
	blocks?: Block[];
}

/** An entry's `data`: the given fields, and a body only when `blocks` is given. */
function dataOf(seed: DataSeed) {
	return { fields: seed.fields ?? {}, ...(seed.blocks === undefined ? {} : { body: { blocks: seed.blocks } }) };
}

/** Creates an active entry with its `ko` source working copy through `entries.create`. */
async function createEntry(seed: DataSeed = {}, collection = POSTS) {
	return montiOf().entries.create({ collection, locale: "ko", slug: `entry-${randomUUID()}`, data: dataOf(seed) });
}

/** Adds a working copy in a translation locale through `entries.addLocale`. */
async function addLocale(id: string, locale: string, seed: DataSeed = {}) {
	return montiOf().entries.addLocale({ id, locale, slug: `entry-${randomUUID()}`, data: dataOf(seed) });
}

/** Replaces the data of an entry's working copy in `locale` (its source locale when left out) through `entries.update`. */
async function changeData(id: string, seed: DataSeed, locale?: string) {
	return montiOf().entries.update({ id, locale, data: dataOf(seed) });
}

/** Moves an entry to the trash by setting its `trashed_at`. */
async function trash(id: string) {
	await db.updateTable("entries").set({ trashed_at: new Date() }).where("id", "=", id).execute();
}

/** The `slug`, `data` and `translation_seen` of one working copy as the table holds it. */
async function localeRow(entryId: string, locale: string) {
	return db
		.selectFrom("entry_locales")
		.select(["slug", "data", "translation_seen"])
		.where("entry_id", "=", entryId)
		.where("locale", "=", locale)
		.executeTakeFirstOrThrow();
}

function byLocale<T extends { locale: string }>(rows: T[]): T[] {
	return [...rows].sort((a, b) => (a.locale < b.locale ? -1 : a.locale > b.locale ? 1 : 0));
}

// ---- get and list ----

it("TST-READ-1 reports every field as unseen for a locale nothing has confirmed", async () => {
	const entry = await createEntry({ fields: FIELDS }, NOTES);
	await addLocale(entry.id, "en");

	const output = await montiOf().translationStatus.get({ id: entry.id, locale: "en" });

	// TST-READ-1.1
	expect(output).toMatchObject({ id: entry.id, collection: NOTES, locale: "en", source_locale: "ko" });
	// TST-READ-1.2
	expect(output.fields).toEqual({ title: { status: "unseen" }, summary: { status: "unseen" } });
	// TST-READ-1.3
	expect(output.blocks).toEqual([]);
});

it("TST-READ-2 reports a confirmed field as seen while its source stays and outdated once it changes", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true, summary: true } });
	await changeData(entry.id, { fields: { ...FIELDS, title: "바뀐 제목" } });

	const output = await montiOf().translationStatus.get({ id: entry.id, locale: "en" });

	// TST-READ-2.1
	expect(output.fields.title).toEqual({ status: "outdated", seen_value: "제목" });
	// TST-READ-2.2
	expect(output.fields.summary).toEqual({ status: "seen", seen_value: "요약" });
});

it("TST-READ-3 gives each body block that holds text or nothing a status and none to container blocks", async () => {
	const table: Block = { id: "s-table", type: "table" };
	const blocks = [paragraph("s1", "첫 문단"), quote("s-quote", [paragraph("s2", "인용 문단")]), table];
	const entry = await createEntry({ fields: FIELDS, blocks });
	await addLocale(entry.id, "en");

	const output = await montiOf().translationStatus.get({ id: entry.id, locale: "en" });

	// TST-READ-3.1
	expect(output.blocks).toEqual([
		{ id: "s1", status: "unseen" },
		{ id: "s2", status: "unseen" },
		{ id: "s-table", status: "unseen" },
	]);
});

it("TST-READ-4 reports a linked body block as seen while its source stays and outdated once it changes", async () => {
	const first = paragraph("s1", "첫 문단");
	const second = paragraph("s2", "둘째 문단");
	const entry = await createEntry({ fields: FIELDS, blocks: [first, second] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "First"), paragraph("e2", "Second")] });
	await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		blocks: { s1: { link: "e1" }, s2: { link: "e2" } },
	});
	await changeData(entry.id, { fields: FIELDS, blocks: [paragraph("s1", "바뀐 문단"), second] });

	const output = await montiOf().translationStatus.get({ id: entry.id, locale: "en" });

	// TST-READ-4.1
	expect(output.blocks[0]).toEqual({ id: "s1", status: "outdated", link: "e1", seen_value: first });
	// TST-READ-4.2
	expect(output.blocks[1]).toEqual({ id: "s2", status: "seen", link: "e2", seen_value: second });
});

it("TST-READ-5 reports a body block excluded from translation as seen while its source stays and outdated once it changes", async () => {
	const first = paragraph("s1", "첫 문단");
	const second = paragraph("s2", "둘째 문단");
	const entry = await createEntry({ fields: FIELDS, blocks: [first, second] });
	await addLocale(entry.id, "en");
	await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		blocks: { s1: { exclude: true }, s2: { exclude: true } },
	});
	await changeData(entry.id, { fields: FIELDS, blocks: [paragraph("s1", "바뀐 문단"), second] });

	const output = await montiOf().translationStatus.get({ id: entry.id, locale: "en" });

	// TST-READ-5.1
	expect(output.blocks[0]).toEqual({ id: "s1", status: "outdated", exclude: true, seen_value: first });
	// TST-READ-5.2
	expect(output.blocks[1]).toEqual({ id: "s2", status: "seen", exclude: true, seen_value: second });
});

it("TST-READ-6 reports a source block as outdated once its linked block is deleted from the translation body", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { s1: { link: "e1" } } });
	await changeData(entry.id, { blocks: [] }, "en");

	const output = await montiOf().translationStatus.get({ id: entry.id, locale: "en" });

	// TST-READ-6.1
	expect(output.blocks.map((block) => block.status)).toEqual(["outdated"]);
});

it("TST-READ-7 rejects reading the status of the source locale with BAD_REQUEST", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");

	// TST-READ-7.1
	await expect(montiOf().translationStatus.get({ id: entry.id, locale: "ko" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("TST-READ-8 rejects reading the status of a locale the entry does not have with NOT_FOUND", async () => {
	const entry = await createEntry({ fields: FIELDS });

	// TST-READ-8.1
	await expect(montiOf().translationStatus.get({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("TST-READ-9 rejects reading the status of a trashed entry with NOT_FOUND", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await trash(entry.id);

	// TST-READ-9.1
	await expect(montiOf().translationStatus.get({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("TST-READ-10 lists one row per translation locale with its outdated and unseen counts", async () => {
	const entry = await createEntry({ fields: { title: "제목" }, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });
	await addLocale(entry.id, "ja");
	const trashed = await createEntry({ fields: FIELDS });
	await addLocale(trashed.id, "en");
	await trash(trashed.id);
	await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		fields: { title: true },
		blocks: { s1: { link: "e1" } },
	});
	await changeData(entry.id, { fields: { title: "제목" }, blocks: [paragraph("s1", "바뀐 문단")] });

	const output = await montiOf().translationStatus.list({});

	const shared = { id: entry.id, collection: POSTS, source_locale: "ko" };
	// TST-READ-10.1
	expect(byLocale(output)).toEqual([
		{ ...shared, locale: "en", outdated_count: 1, unseen_count: 0 },
		{ ...shared, locale: "ja", outdated_count: 0, unseen_count: 2 },
	]);
});

it("TST-READ-11 lists only the translation locales of the given entry", async () => {
	const first = await createEntry();
	await addLocale(first.id, "en");
	const other = await createEntry();
	await addLocale(other.id, "en");

	const output = await montiOf().translationStatus.list({ id: first.id });

	// TST-READ-11.1
	expect(output).toEqual([
		{ id: first.id, collection: POSTS, locale: "en", source_locale: "ko", outdated_count: 0, unseen_count: 0 },
	]);
});

it("TST-READ-12 lists only the rows matching both the given collection and locale", async () => {
	const post = await createEntry();
	await addLocale(post.id, "en");
	await addLocale(post.id, "ja");
	const note = await createEntry({}, NOTES);
	await addLocale(note.id, "en");

	const output = await montiOf().translationStatus.list({ collection: POSTS, locale: "en" });

	// TST-READ-12.1
	expect(output).toEqual([
		{ id: post.id, collection: POSTS, locale: "en", source_locale: "ko", outdated_count: 0, unseen_count: 0 },
	]);
});

// ---- update ----

it("TST-UPD-1 makes an unseen field seen when it is confirmed", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en", { fields: { title: "Title" } });
	const before = await localeRow(entry.id, "en");

	const output = await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } });

	// TST-UPD-1.1
	expect(output.fields).toEqual({ title: { status: "seen", seen_value: "제목" }, summary: { status: "unseen" } });
	const { slug, data } = await localeRow(entry.id, "en");
	// TST-UPD-1.2
	expect({ slug, data }).toEqual({ slug: before.slug, data: before.data });
});

it("TST-UPD-2 makes an outdated field seen again when it is confirmed again", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } });
	await changeData(entry.id, { fields: { ...FIELDS, title: "바뀐 제목" } });

	const output = await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } });

	// TST-UPD-2.1
	expect(output.fields.title).toEqual({ status: "seen", seen_value: "바뀐 제목" });
});

it("TST-UPD-3 makes only the field whose record is deleted unseen again", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true, summary: true } });

	const output = await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: null } });

	// TST-UPD-3.1
	expect(output.fields.title).toEqual({ status: "unseen" });
	// TST-UPD-3.2
	expect(output.fields.summary?.status).toBe("seen");
});

it("TST-UPD-4 makes a source block seen when it is linked to a translation block", async () => {
	const source = paragraph("s1", "인용 문단");
	const entry = await createEntry({ fields: FIELDS, blocks: [quote("s-quote", [source])] });
	await addLocale(entry.id, "en", { blocks: [quote("e-quote", [paragraph("e1", "Quoted")])] });
	const before = await localeRow(entry.id, "en");
	const sourceBefore = await localeRow(entry.id, "ko");

	const output = await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		blocks: { s1: { link: "e1" } },
	});

	// TST-UPD-4.1
	expect(output.blocks).toContainEqual({ id: "s1", status: "seen", link: "e1", seen_value: source });
	const { slug, data } = await localeRow(entry.id, "en");
	// TST-UPD-4.2
	expect({ slug, data }).toEqual({ slug: before.slug, data: before.data });
	// TST-UPD-4.3
	expect((await localeRow(entry.id, "ko")).translation_seen).toEqual(sourceBefore.translation_seen);
});

it("TST-UPD-5 makes an outdated block seen again when it is linked to the same translation block again", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { s1: { link: "e1" } } });
	const changed = paragraph("s1", "바뀐 문단");
	await changeData(entry.id, { fields: FIELDS, blocks: [changed] });

	const output = await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		blocks: { s1: { link: "e1" } },
	});

	// TST-UPD-5.1
	expect(output.blocks).toEqual([{ id: "s1", status: "seen", link: "e1", seen_value: changed }]);
});

it("TST-UPD-6 makes an unseen block seen when it is excluded from translation", async () => {
	const source = paragraph("s1", "문단");
	const entry = await createEntry({ fields: FIELDS, blocks: [source] });
	await addLocale(entry.id, "en");

	const output = await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		blocks: { s1: { exclude: true } },
	});

	// TST-UPD-6.1
	expect(output.blocks).toEqual([{ id: "s1", status: "seen", exclude: true, seen_value: source }]);
});

it("TST-UPD-7 makes only the block whose record is deleted unseen again", async () => {
	const entry = await createEntry({
		fields: FIELDS,
		blocks: [paragraph("s1", "첫 문단"), paragraph("s2", "둘째 문단")],
	});
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "First"), paragraph("e2", "Second")] });
	await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		blocks: { s1: { link: "e1" }, s2: { link: "e2" } },
	});

	const output = await montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { s1: null } });

	// TST-UPD-7.1
	expect(output.blocks[0]).toEqual({ id: "s1", status: "unseen" });
	// TST-UPD-7.2
	expect(output.blocks[1]?.status).toBe("seen");
});

it("TST-UPD-8 rejects confirming a field the source does not have with BAD_REQUEST", async () => {
	const entry = await createEntry({ fields: { title: "제목" } });
	await addLocale(entry.id, "en");

	// TST-UPD-8.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { summary: true } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-9 rejects linking a block the source body does not have with BAD_REQUEST", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });

	// TST-UPD-9.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { missing: { link: "e1" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-10 rejects linking a container block with BAD_REQUEST", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [quote("s-quote", [paragraph("s1", "인용 문단")])] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });

	// TST-UPD-10.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { "s-quote": { link: "e1" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-11 rejects linking to a block the translation body does not have with BAD_REQUEST", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });

	// TST-UPD-11.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { s1: { link: "missing" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-12 rejects updating the status of the source locale with BAD_REQUEST", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");

	// TST-UPD-12.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "ko", fields: { title: true } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-13 rejects updating the status of a locale the entry does not have with NOT_FOUND", async () => {
	const entry = await createEntry({ fields: FIELDS });

	// TST-UPD-13.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } }),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("TST-UPD-14 rejects updating the status of a trashed entry with NOT_FOUND", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await trash(entry.id);

	// TST-UPD-14.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } }),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
