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
import { syncSchemaTables } from "../schema/sync-tables";
import { translationStatus } from "./translation-status";

type Row = Record<string, unknown>;

let testDb: TestDatabase;
let db: Kysely<Database>;
/** 컬렉션별 테이블을 이름으로 읽고 쓰는 연결. */
let tables: Kysely<Record<string, Row>>;

const POSTS = "posts";
const NOTES = "notes";
const PAGES = "pages";

/** `posts`는 본문과 글자 필드 둘, `notes`는 본문 없이 같은 필드 둘, `pages`는 본문과 글자 필드 하나를 가진다. */
const SCHEMA: Schema = {
	locales: ["ko", "en", "ja"],
	collections: {
		[POSTS]: { body: true, fields: { title: { type: "text" }, summary: { type: "text" } } },
		[NOTES]: { fields: { title: { type: "text" }, summary: { type: "text" } } },
		[PAGES]: { body: true, fields: { title: { type: "text" } } },
	},
};

const CONFIG: MontiConfig = { name: "Monti Blog", dev: false };

/** `posts`·`notes` 원문의 필드 값. */
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
	await syncSchemaTables(testDb.db, SCHEMA);
	db = testDb.db as Kysely<Database>;
	tables = testDb.db as Kysely<Record<string, Row>>;
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

/** 글의 `data`: 주어진 필드와, `blocks`를 주었을 때만 본문. */
function dataOf(seed: DataSeed) {
	return { fields: seed.fields ?? {}, ...(seed.blocks === undefined ? {} : { body: { blocks: seed.blocks } }) };
}

/** `entries.create`로 `ko` 원문 작업본을 가진 활성 글을 만든다. */
async function createEntry(seed: DataSeed = {}, collection = POSTS) {
	return montiOf().entries.create({ collection, locale: "ko", slug: `entry-${randomUUID()}`, data: dataOf(seed) });
}

/** `entries.addLocale`로 번역 언어 작업본을 더한다. */
async function addLocale(id: string, locale: string, seed: DataSeed = {}) {
	return montiOf().entries.addLocale({ id, locale, slug: `entry-${randomUUID()}`, data: dataOf(seed) });
}

/** `entries.update`로 `locale`(생략하면 원문 언어) 작업본의 `data`를 통째로 바꾼다. */
async function changeData(id: string, seed: DataSeed, locale?: string) {
	return montiOf().entries.update({ id, locale, data: dataOf(seed) });
}

/** 컬렉션 테이블에서 글의 `trashed_at`을 설정해 휴지통으로 옮긴다. */
async function trash(id: string, collection = POSTS) {
	await tables.updateTable(collection).set({ trashed_at: new Date() }).where("id", "=", id).execute();
}

/** `<collection>_data` 테이블에 저장된 그대로의 작업본(`status = 'draft'`) 행 하나. */
async function draftRow(collection: string, entryId: string, locale: string) {
	return tables
		.selectFrom(`${collection}_data`)
		.selectAll()
		.where("entry_id", "=", entryId)
		.where("locale", "=", locale)
		.where("status", "=", "draft")
		.executeTakeFirstOrThrow();
}

function byLocale<T extends { locale: string }>(rows: T[]): T[] {
	return [...rows].sort((a, b) => (a.locale < b.locale ? -1 : a.locale > b.locale ? 1 : 0));
}

// ---- 조회 (get · list) ----

it("TST-READ-1 아무것도 확인하지 않은 번역 언어는 필드가 모두 미확인 상태이다", async () => {
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

it("TST-READ-2 확인한 필드는 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다", async () => {
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

it("TST-READ-3 본문에서는 글자나 내용이 직접 들어 있는 블록마다 상태를 갖고 컨테이너 블록은 상태를 갖지 않는다", async () => {
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

it("TST-READ-4 연결한 본문 블록은 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다", async () => {
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

it("TST-READ-5 번역 제외로 표시한 본문 블록은 원문이 그대로이면 확인 완료, 바뀌었으면 원문 변경 상태이다", async () => {
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

it("TST-READ-6 연결한 번역 블록이 번역 본문에서 지워지면 그 원문 블록은 원문 변경 상태가 된다", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { s1: { link: "e1" } } });
	await changeData(entry.id, { blocks: [] }, "en");

	const output = await montiOf().translationStatus.get({ id: entry.id, locale: "en" });

	// TST-READ-6.1
	expect(output.blocks.map((block) => block.status)).toEqual(["outdated"]);
});

it("TST-READ-7 원문 언어의 번역 상태는 조회할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");

	// TST-READ-7.1
	await expect(montiOf().translationStatus.get({ id: entry.id, locale: "ko" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("TST-READ-8 글에 없는 언어의 번역 상태는 조회할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS });

	// TST-READ-8.1
	await expect(montiOf().translationStatus.get({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("TST-READ-9 휴지통에 있는 글의 번역 상태는 조회할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await trash(entry.id);

	// TST-READ-9.1
	await expect(montiOf().translationStatus.get({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("TST-READ-10 번역 언어마다 원문이 바뀐 항목과 확인하지 않은 항목의 개수를 한 줄씩 돌려준다", async () => {
	const entry = await createEntry({ fields: { title: "제목" }, blocks: [paragraph("s1", "문단")] }, PAGES);
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });
	await addLocale(entry.id, "ja");
	const trashed = await createEntry({ fields: { title: "제목" } }, PAGES);
	await addLocale(trashed.id, "en");
	await trash(trashed.id, PAGES);
	await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		fields: { title: true },
		blocks: { s1: { link: "e1" } },
	});
	await changeData(entry.id, { fields: { title: "제목" }, blocks: [paragraph("s1", "바뀐 문단")] });

	const output = await montiOf().translationStatus.list();

	const shared = { id: entry.id, collection: PAGES, source_locale: "ko" };
	// TST-READ-10.1
	expect(byLocale(output)).toEqual([
		{ ...shared, locale: "en", outdated_count: 1, unseen_count: 0 },
		{ ...shared, locale: "ja", outdated_count: 0, unseen_count: 2 },
	]);
});

it("TST-READ-11 글을 지정하면 그 글의 번역 언어 줄만 돌려준다", async () => {
	const first = await createEntry({ fields: FIELDS });
	await addLocale(first.id, "en");
	const other = await createEntry({ fields: FIELDS });
	await addLocale(other.id, "en");

	const output = await montiOf().translationStatus.list({ id: first.id });

	// TST-READ-11.1
	expect(output.map((row) => [row.id, row.locale])).toEqual([[first.id, "en"]]);
});

it("TST-READ-12 컬렉션과 언어를 지정하면 둘 다 일치하는 줄만 돌려준다", async () => {
	const post = await createEntry({ fields: FIELDS });
	await addLocale(post.id, "en");
	await addLocale(post.id, "ja");
	const note = await createEntry({ fields: FIELDS }, NOTES);
	await addLocale(note.id, "en");

	const output = await montiOf().translationStatus.list({ collection: POSTS, locale: "en" });

	// TST-READ-12.1
	expect(output.map((row) => [row.id, row.collection, row.locale])).toEqual([[post.id, POSTS, "en"]]);
});

// ---- 갱신 (update) ----

it("TST-UPD-1 확인하지 않은 필드를 확인하면 확인 완료 상태가 된다", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en", { fields: { title: "Title" } });
	const before = await draftRow(POSTS, entry.id, "en");

	const output = await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } });

	// TST-UPD-1.1
	expect(output.fields).toEqual({ title: { status: "seen", seen_value: "제목" }, summary: { status: "unseen" } });
	const after = await draftRow(POSTS, entry.id, "en");
	// TST-UPD-1.2
	expect([after.slug, after.title, after.summary]).toEqual([before.slug, before.title, before.summary]);
});

it("TST-UPD-2 원문이 바뀐 필드를 다시 확인하면 확인 완료 상태가 된다", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } });
	await changeData(entry.id, { fields: { ...FIELDS, title: "바뀐 제목" } });

	const output = await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } });

	// TST-UPD-2.1
	expect(output.fields.title).toEqual({ status: "seen", seen_value: "바뀐 제목" });
});

it("TST-UPD-3 필드의 기록을 지우면 그 필드만 미확인 상태로 돌아간다", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true, summary: true } });

	const output = await montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: null } });

	// TST-UPD-3.1
	expect(output.fields.title).toEqual({ status: "unseen" });
	// TST-UPD-3.2
	expect(output.fields.summary?.status).toBe("seen");
});

it("TST-UPD-4 아직 연결하지 않은 원문 블록을 번역 블록과 연결하면 확인 완료 상태가 된다", async () => {
	const source = paragraph("s1", "인용 문단");
	const entry = await createEntry({ fields: FIELDS, blocks: [quote("s-quote", [source])] });
	await addLocale(entry.id, "en", { blocks: [quote("e-quote", [paragraph("e1", "Quoted")])] });
	const before = await draftRow(POSTS, entry.id, "en");
	const sourceBefore = await draftRow(POSTS, entry.id, "ko");

	const output = await montiOf().translationStatus.update({
		id: entry.id,
		locale: "en",
		blocks: { s1: { link: "e1" } },
	});

	// TST-UPD-4.1
	expect(output.blocks).toContainEqual({ id: "s1", status: "seen", link: "e1", seen_value: source });
	const after = await draftRow(POSTS, entry.id, "en");
	// TST-UPD-4.2
	expect([after.slug, after.body]).toEqual([before.slug, before.body]);
	// TST-UPD-4.3
	expect((await draftRow(POSTS, entry.id, "ko")).translation_seen).toEqual(sourceBefore.translation_seen);
});

it("TST-UPD-5 원문이 바뀐 블록을 같은 번역 블록과 다시 연결하면 확인 완료 상태가 된다", async () => {
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

it("TST-UPD-6 아직 확인하지 않은 원문 블록을 번역 제외로 표시하면 확인 완료 상태가 된다", async () => {
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

it("TST-UPD-7 블록의 기록을 지우면 그 블록만 미확인 상태로 돌아간다", async () => {
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

it("TST-UPD-8 원문에 없는 필드는 확인 완료로 표시할 수 없다", async () => {
	const entry = await createEntry({ fields: { title: "제목" } }, PAGES);
	await addLocale(entry.id, "en");

	// TST-UPD-8.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { summary: true } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-9 원문 본문에 없는 블록은 연결할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });

	// TST-UPD-9.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { missing: { link: "e1" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-10 컨테이너 블록은 번역 블록과 연결할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [quote("s-quote", [paragraph("s1", "인용 문단")])] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });

	// TST-UPD-10.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { "s-quote": { link: "e1" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-11 번역 본문에 없는 블록과는 연결할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS, blocks: [paragraph("s1", "문단")] });
	await addLocale(entry.id, "en", { blocks: [paragraph("e1", "Paragraph")] });

	// TST-UPD-11.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", blocks: { s1: { link: "missing" } } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-12 원문 언어의 번역 상태는 수정할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");

	// TST-UPD-12.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "ko", fields: { title: true } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("TST-UPD-13 글에 없는 언어의 번역 상태는 수정할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS });

	// TST-UPD-13.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } }),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("TST-UPD-14 휴지통에 있는 글의 번역 상태는 수정할 수 없다", async () => {
	const entry = await createEntry({ fields: FIELDS });
	await addLocale(entry.id, "en");
	await trash(entry.id);

	// TST-UPD-14.1
	await expect(
		montiOf().translationStatus.update({ id: entry.id, locale: "en", fields: { title: true } }),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
