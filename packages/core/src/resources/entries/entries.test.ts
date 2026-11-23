import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { holdingAfter, overlap } from "../../__test__/race";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { MontiConfig, Schema } from "../../engine/types";
import { validateDoc } from "../../rich-text/validate-doc";
import { syncSchemaTables } from "../schema/sync-tables";
import { trash } from "../trash/trash";
import { entries } from "./entries";
import type { Entry } from "./types";

type Row = Record<string, unknown>;

let testDb: TestDatabase;
let db: Kysely<Database>;
/** 컬렉션별 테이블을 이름으로 읽고 쓰는 연결. */
let tables: Kysely<Record<string, Row>>;

const POSTS = "posts";
const PAGES = "pages";
const TOPICS = "topics";
const NOTES = "notes";
const CARDS = "cards";
const SERIES = "series";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PUBLISHED_AT = new Date("2026-11-01T09:00:00.000Z");

/**
 * `posts`는 본문과 모든 필드 종류를 가지고, 조건부 필드의 두 분기에 같은 이름의 하위 미디어 필드(`image`)가 있다.
 * `pages`는 `topic`을 여러 개 고르고, `topics`는 본문이 없다. `notes`는 필수 필드(다건 `select` 포함)와 첫 분기에 필수
 * 하위 필드·관계를 가진 조건부 필드를 가진다. `cards`는 필수 관계와 선택 미디어를 가진다. `series`는 `topics`가 아닌
 * 컬렉션(`pages`)을 가리키는 다건 관계만 가진다.
 */
const SCHEMA: Schema = {
	locales: ["ko", "en"],
	collections: {
		[POSTS]: {
			body: true,
			fields: {
				title: { type: "text", max: 20, required: true },
				views: { type: "number" },
				featured: { type: "boolean" },
				date: { type: "date" },
				category: { type: "select", options: ["news", "tech"] },
				tags: { type: "select", options: ["news", "tech"], many: true },
				cover: { type: "media", many: false },
				gallery: { type: "media", many: true },
				topic: { type: "relation", to: TOPICS, many: false },
				related: { type: "relation", to: TOPICS, many: true },
				layout: {
					type: "conditional",
					options: {
						hero: {
							fields: {
								image: { type: "media" },
								caption: { type: "text" },
								link: { type: "relation", to: TOPICS },
								photos: { type: "media", many: true },
							},
						},
						plain: { fields: { note: { type: "text" }, image: { type: "media" } } },
					},
				},
			},
		},
		[PAGES]: { fields: { topic: { type: "relation", to: TOPICS, many: true } } },
		[TOPICS]: { fields: { name: { type: "text" } } },
		[NOTES]: {
			fields: {
				title: { type: "text", required: true },
				rank: { type: "number", required: true },
				pinned: { type: "boolean", required: true },
				labels: { type: "select", options: ["a", "b"], many: true, required: true },
				kind: {
					type: "conditional",
					options: {
						link: { fields: { url: { type: "text", required: true }, topic: { type: "relation", to: TOPICS } } },
						plain: { fields: { note: { type: "text" } } },
					},
				},
			},
		},
		[CARDS]: {
			fields: {
				topic: { type: "relation", to: TOPICS, required: true },
				cover: { type: "media", required: false },
			},
		},
		[SERIES]: { fields: { pages: { type: "relation", to: PAGES, many: true } } },
	},
};

/** 설정이 기본 블록에 더하는 블록 하나. */
const GALLERY = { type: "gallery", holds: "nothing" } as const;

const CONFIG: MontiConfig = { name: "Monti Blog", dev: false, blocks: [GALLERY] };

/** `validateDoc`을 통과하고 미디어를 참조하지 않는 본문. */
const PLAIN = { blocks: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

/** 문제가 둘인 본문: 갤러리 블록의 `id`가 비어 있고 두 번째 블록의 종류가 등록되지 않았다. */
const BROKEN = {
	blocks: [
		{ id: "", type: "gallery" },
		{ id: "x1", type: "unregistered" },
	],
};

/** 이미지 블록 하나가 `mediaId`를 참조하는 본문. */
function imageDoc(mediaId: string) {
	return { blocks: [{ id: "i1", type: "image", attrs: { mediaId } }] };
}

/** 실행이 거절되면 그 오류 코드, 성공하면 null. */
async function codeOf(run: Promise<unknown>): Promise<string | null> {
	return run.then(
		() => null,
		(error: { code: string }) => error.code,
	);
}

function montiOf(schema: Schema = SCHEMA) {
	return createMonti(db, { entries }, [], {
		schema,
		config: CONFIG,
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

/** `posts` 글의 작업본을 읽는 문장(`entries`가 글을 찾을 때 가장 먼저 실행한다). */
const DRAFT_READ = /from "posts" as "e" inner join "posts_data" as "d"/;
/** `posts` 작업본의 슬러그가 비어 있는지 확인하는 문장. */
const SLUG_CHECK = /"d"\."slug" = \$/;

/**
 * 휴지통 동작도 쓰는 엔진. `hold`를 주면 SQL이 `pattern`에 맞는 첫 문장을 실행한 직후 `hold`가 끝날 때까지 멈춘다.
 */
function heldMonti(pattern?: RegExp, hold?: () => Promise<void>) {
	const on = pattern === undefined || hold === undefined ? db : holdingAfter(db, pattern, hold);
	return createMonti(on, { entries, trash }, [], {
		schema: SCHEMA,
		config: CONFIG,
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "@monti-cms/core", [initial]);
	await syncSchemaTables(testDb.db, SCHEMA);
	db = testDb.db as Kysely<Database>;
	tables = testDb.db.withTables<Record<string, Row>>();
});

afterEach(async () => {
	await testDb.drop();
});

async function seedMedia(trashed = false): Promise<string> {
	const id = randomUUID();
	await db
		.insertInto("media")
		.values({
			id,
			folder_id: null,
			key: randomUUID(),
			filename: "image.png",
			mime_type: "image/png",
			size: 1024,
			trashed_at: trashed ? new Date() : null,
		})
		.execute();
	return id;
}

async function trashMedia(id: string): Promise<void> {
	await db.updateTable("media").set({ trashed_at: new Date() }).where("id", "=", id).execute();
}

interface FolderSeed {
	scope?: string;
	parent_id?: string | null;
	trashed?: boolean;
}

async function seedFolder(seed: FolderSeed = {}): Promise<string> {
	const id = randomUUID();
	await db
		.insertInto("folders")
		.values({
			id,
			scope: seed.scope ?? POSTS,
			parent_id: seed.parent_id ?? null,
			name: id,
			trashed_at: seed.trashed ? new Date() : null,
		})
		.execute();
	return id;
}

/** `<collection>_rels`의 한 줄: `path`의 `position`번째 대상이 `column` 열의 `id`다. */
interface RelSeed {
	path: string;
	column: string;
	ids: string[];
}

interface CopySeed {
	slug?: string | null;
	columns?: Row;
	rels?: RelSeed[];
	published_at?: Date | null;
	translation_seen?: Row;
}

/** 글 하나의 한 언어·상태 행을 `<collection>_data`에 넣고, 다건 참조를 `<collection>_rels`에 넣는다. */
async function seedCopy(collection: string, entry_id: string, locale: string, status: string, seed: CopySeed = {}) {
	const row = {
		entry_id,
		locale,
		status,
		slug: seed.slug === undefined ? `entry-${randomUUID()}` : seed.slug,
		published_at: seed.published_at === undefined ? (status === "published" ? PUBLISHED_AT : null) : seed.published_at,
		translation_seen: JSON.stringify(seed.translation_seen ?? {}),
		...seed.columns,
	};
	await tables.insertInto(`${collection}_data`).values(row).execute();
	for (const { path, column, ids } of seed.rels ?? []) {
		for (const [position, id] of ids.entries()) {
			await tables
				.insertInto(`${collection}_rels`)
				.values({ entry_id, locale, status, path, position, [column]: id })
				.execute();
		}
	}
	return row;
}

interface EntrySeed extends CopySeed {
	collection?: string;
	locale?: string;
	folder_id?: string | null;
	trashed?: boolean;
}

/** 글 하나와 원문 언어(따로 주지 않으면 `ko`) 작업본을 넣는다. */
async function seedEntry(seed: EntrySeed = {}) {
	const collection = seed.collection ?? POSTS;
	const row = {
		id: randomUUID(),
		source_locale: seed.locale ?? "ko",
		folder_id: seed.folder_id ?? null,
		trashed_at: seed.trashed ? new Date() : null,
	};
	await tables.insertInto(collection).values(row).execute();
	const draft = await seedCopy(collection, row.id, row.source_locale, "draft", seed);
	return { ...row, collection, slug: draft.slug };
}

async function trashEntry(collection: string, id: string): Promise<void> {
	await tables.updateTable(collection).set({ trashed_at: new Date() }).where("id", "=", id).execute();
}

/** 작업본과 다른 `slug`·제목의 원문 언어 발행본을 가진 `posts` 활성 글. */
async function seedPublishedEntry(seed: EntrySeed = {}) {
	const entry = await seedEntry({ columns: { title: "Draft" }, ...seed });
	const slug = `live-${randomUUID()}`;
	const published = await seedCopy(entry.collection, entry.id, entry.source_locale, "published", {
		slug,
		columns: { title: "Live" },
	});
	return { entry, published: { ...published, slug } };
}

interface UseSeed {
	media_id: string;
	source_kind: "entry" | "template";
	source_id: string;
	field_path: string;
}

async function seedUse(use: UseSeed): Promise<UseSeed> {
	await db.insertInto("media_uses").values(use).execute();
	return use;
}

/** 글의 `cover` 필드가 `media_id`를 참조하는 `media_uses` 행. */
function coverUse(source_id: string, media_id: string): UseSeed {
	return { media_id, source_kind: "entry", source_id, field_path: "cover" };
}

/** `cover`가 `mediaId`를 참조하는 `posts` 글과 그 `media_uses` 행. */
async function seedEntryUsing(mediaId: string, seed: EntrySeed = {}) {
	const entry = await seedEntry({ ...seed, columns: { cover: mediaId, ...seed.columns } });
	const use = await seedUse(coverUse(entry.id, mediaId));
	return { entry, use };
}

async function entryRows(collection: string) {
	return tables.selectFrom(collection).selectAll().execute();
}

async function entryRow(collection: string, id: string) {
	return tables.selectFrom(collection).selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

/** `<collection>_data`의 행들. `entry_id`를 주면 그 글의 행만 `locale`, `status` 순으로 돌려준다. */
async function dataRows(collection: string, entry_id?: string) {
	let query = tables.selectFrom(`${collection}_data`).selectAll();
	if (entry_id !== undefined) query = query.where("entry_id", "=", entry_id);
	return query.orderBy("entry_id").orderBy("locale").orderBy("status").execute();
}

async function dataRow(collection: string, entry_id: string, locale: string, status: string) {
	return tables
		.selectFrom(`${collection}_data`)
		.selectAll()
		.where("entry_id", "=", entry_id)
		.where("locale", "=", locale)
		.where("status", "=", status)
		.executeTakeFirst();
}

/** 글의 `<collection>_rels` 행들에서 `column` 열을 `id`로 꺼내 언어·상태·경로·순서대로 돌려준다. */
async function relsRows(collection: string, entry_id: string, column: string) {
	const rows = await tables
		.selectFrom(`${collection}_rels`)
		.selectAll()
		.where("entry_id", "=", entry_id)
		.orderBy("locale")
		.orderBy("status")
		.orderBy("path")
		.orderBy("position")
		.execute();
	return rows
		.filter((row) => row[column] !== null)
		.map((row) => ({
			locale: row.locale,
			status: row.status,
			path: row.path,
			position: row.position,
			id: row[column],
		}));
}

async function useRows(source_kind: "entry" | "template", source_id: string) {
	return db
		.selectFrom("media_uses")
		.selectAll()
		.where("source_kind", "=", source_kind)
		.where("source_id", "=", source_id)
		.orderBy("field_path")
		.orderBy("media_id")
		.execute();
}

async function allUseRows() {
	return db.selectFrom("media_uses").selectAll().execute();
}

function idsOf(rows: { id: string }[]): string[] {
	return rows.map((row) => row.id).sort();
}

/** 테이블 행들의 `id`를 정렬해 돌려준다. */
function rowIds(rows: Row[]): string[] {
	return rows.map((row) => String(row.id)).sort();
}

/** 글마다 `id`와 `locale`을 `id` 순으로: 행이 돌아오는 순서에 기대지 않는다. */
function idsAndLocales(rows: { id: string; locale: string }[]) {
	return rows.map(({ id, locale }) => ({ id, locale })).sort((a, b) => a.id.localeCompare(b.id));
}

function sortedIds(ids: string[]): string[] {
	return [...ids].sort();
}

// ---- 1. 생성 ----

it("ENT-CRT-1 필수 정보만으로 빈 초안 작업본을 만들면 슬러그와 필수 필드를 비워 둔 채 기본값을 채운다", async () => {
	const output = await montiOf().entries.create({ collection: NOTES, locale: "ko" });

	// ENT-CRT-1.1
	expect(output).toStrictEqual({
		id: expect.stringMatching(UUID),
		collection: NOTES,
		locale: "ko",
		source_locale: "ko",
		folder_id: null,
		slug: null,
		fields: {},
		published_at: null,
	});
	// ENT-CRT-1.2
	expect(await entryRows(NOTES)).toEqual([{ id: output.id, source_locale: "ko", folder_id: null, trashed_at: null }]);
	// ENT-CRT-1.3
	expect(await dataRows(NOTES)).toMatchObject([
		{ entry_id: output.id, locale: "ko", status: "draft", slug: null, translation_seen: {} },
	]);
});

it("ENT-CRT-2 지정한 ID와 슬러그로 작업본을 만든다", async () => {
	const id = randomUUID();

	const output = await montiOf().entries.create({ __preset_id: id, collection: POSTS, locale: "ko", slug: "hello" });

	// ENT-CRT-2.1
	expect(output).toMatchObject({ id, slug: "hello" });
	// ENT-CRT-2.2
	expect(rowIds(await entryRows(POSTS))).toEqual([id]);
	// ENT-CRT-2.3
	expect(await dataRows(POSTS)).toMatchObject([{ entry_id: id, status: "draft", slug: "hello" }]);
});

it("ENT-CRT-3 단일 값 필드와 본문, 폴더를 담아 작업본을 저장한다", async () => {
	const folder = await seedFolder();
	const fields = {
		title: "Hello",
		views: 3.5,
		featured: true,
		date: "2026-11-20T01:00:00.000Z",
		category: "news",
		tags: ["news", "tech"],
	};

	const output = await montiOf().entries.create({
		collection: POSTS,
		locale: "ko",
		slug: "hello",
		folder_id: folder,
		fields,
		body: PLAIN,
	});

	// ENT-CRT-3.1
	expect({ folder_id: output.folder_id, slug: output.slug, fields: output.fields, body: output.body }).toEqual({
		folder_id: folder,
		slug: "hello",
		fields,
		body: PLAIN,
	});
	// ENT-CRT-3.2
	expect(await entryRow(POSTS, output.id)).toMatchObject({ id: output.id, folder_id: folder });
	// ENT-CRT-3.3
	expect(await dataRow(POSTS, output.id, "ko", "draft")).toMatchObject({
		slug: "hello",
		body: PLAIN,
		...fields,
		date: new Date(fields.date),
	});
});

it("ENT-CRT-4 단건·다건 미디어와 관계 및 조건부 필드를 데이터 테이블과 연결 테이블에 저장한다", async () => {
	const [cover, first, second, image, photo] = [
		await seedMedia(),
		await seedMedia(),
		await seedMedia(),
		await seedMedia(),
		await seedMedia(),
	];
	const [topic, related1, related2, link] = [
		await seedEntry({ collection: TOPICS }),
		await seedEntry({ collection: TOPICS }),
		await seedEntry({ collection: TOPICS }),
		await seedEntry({ collection: TOPICS }),
	];
	const fields = {
		cover,
		gallery: [second, first],
		topic: topic.id,
		related: [related2.id, related1.id],
		layout: { option: "hero", fields: { image, caption: "Cap", link: link.id, photos: [photo] } },
	};

	const output = await montiOf().entries.create({ collection: POSTS, locale: "ko", fields });

	// ENT-CRT-4.1
	expect(output.fields).toEqual(fields);
	// ENT-CRT-4.2
	expect(await dataRow(POSTS, output.id, "ko", "draft")).toMatchObject({
		cover,
		topic: topic.id,
		layout: "hero",
		layout__hero__image: image,
		layout__hero__caption: "Cap",
		layout__hero__link: link.id,
		layout__plain__note: null,
	});
	// ENT-CRT-4.3
	expect({
		media: await relsRows(POSTS, output.id, "media_id"),
		topics: await relsRows(POSTS, output.id, "topics_id"),
	}).toEqual({
		media: [
			{ locale: "ko", status: "draft", path: "gallery", position: 0, id: second },
			{ locale: "ko", status: "draft", path: "gallery", position: 1, id: first },
			{ locale: "ko", status: "draft", path: "layout.hero.photos", position: 0, id: photo },
		],
		topics: [
			{ locale: "ko", status: "draft", path: "related", position: 0, id: related2.id },
			{ locale: "ko", status: "draft", path: "related", position: 1, id: related1.id },
		],
	});
});

it("ENT-CRT-5 본문·최상위 미디어·조건부 하위 미디어의 참조를 경로별로 한 번씩 사용처에 기록한다", async () => {
	const [first, second, third] = [await seedMedia(), await seedMedia(), await seedMedia()];
	const body = {
		blocks: [
			{ id: "b1", type: "image", attrs: { mediaId: first } },
			{ id: "b2", type: "image", attrs: { mediaId: third } },
		],
	};

	const output = await montiOf().entries.create({
		collection: POSTS,
		locale: "ko",
		fields: {
			gallery: [first, first.toUpperCase()],
			layout: { option: "hero", fields: { image: second } },
		},
		body,
	});

	const expected: UseSeed[] = [
		{ media_id: first, field_path: "body" },
		{ media_id: third, field_path: "body" },
		{ media_id: first, field_path: "gallery" },
		{ media_id: second, field_path: "layout.hero.image" },
	].map((use) => ({ ...use, source_kind: "entry" as const, source_id: output.id }));
	const sorted = (rows: UseSeed[]) =>
		[...rows].sort((a, b) => `${a.field_path}${a.media_id}`.localeCompare(`${b.field_path}${b.media_id}`));
	// ENT-CRT-5.1
	expect(sorted(await useRows("entry", output.id))).toEqual(sorted(expected));
});

it("ENT-CRT-6 스키마에 없는 컬렉션에는 글을 만들 수 없다", async () => {
	// ENT-CRT-6.1
	await expect(montiOf().entries.create({ collection: "constructor", locale: "ko" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("ENT-CRT-7 스키마에 없는 언어 코드로는 글을 만들 수 없다", async () => {
	// ENT-CRT-7.1
	await expect(montiOf().entries.create({ collection: POSTS, locale: "ja" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-CRT-7.2
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-8 다른 범위의 폴더에는 글을 넣을 수 없다", async () => {
	const folder = await seedFolder({ scope: "media" });

	// ENT-CRT-8.1
	await expect(montiOf().entries.create({ collection: POSTS, locale: "ko", folder_id: folder })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-CRT-8.2
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-9 스키마에 정의되지 않은 필드가 들어 있으면 글을 만들 수 없다", async () => {
	// ENT-CRT-9.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", fields: { unknown: "x" } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-9.2
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-10 필드의 타입이나 길이 제한에 어긋난 값이면 글을 만들 수 없다", async () => {
	const monti = montiOf();

	const codes = [
		await codeOf(monti.entries.create({ collection: POSTS, locale: "ko", fields: { views: "3" } })),
		await codeOf(monti.entries.create({ collection: POSTS, locale: "ko", fields: { title: "x".repeat(21) } })),
	];

	// ENT-CRT-10.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// ENT-CRT-10.2
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-11 조건부 필드에서 선택한 분기에 없는 하위 필드가 들어 있으면 글을 만들 수 없다", async () => {
	// ENT-CRT-11.1
	await expect(
		montiOf().entries.create({
			collection: POSTS,
			locale: "ko",
			fields: { layout: { option: "hero", fields: { note: "x" } } },
		}),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-11.2
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-12 본문을 쓰지 않는 컬렉션에는 본문을 넣을 수 없다", async () => {
	// ENT-CRT-12.1
	await expect(
		montiOf().entries.create({ collection: TOPICS, locale: "ko", fields: {}, body: PLAIN }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-12.2
	expect(await entryRows(TOPICS)).toEqual([]);
});

it("ENT-CRT-13 본문 형식이 맞지 않으면 문제 목록을 담아 글 생성을 거절한다", async () => {
	const error = await montiOf()
		.entries.create({ collection: POSTS, locale: "ko", fields: {}, body: BROKEN })
		.catch((caught: unknown) => caught);

	// ENT-CRT-13.1
	expect(error).toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-13.2
	expect(error).toHaveProperty("details", validateDoc(BROKEN, CONFIG));
	// ENT-CRT-13.3
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-14 필드나 본문이 휴지통에 있는 미디어를 참조하면 글을 만들 수 없다", async () => {
	const trashed = await seedMedia(true);

	const codes = [
		await codeOf(montiOf().entries.create({ collection: POSTS, locale: "ko", fields: { cover: trashed } })),
		await codeOf(montiOf().entries.create({ collection: POSTS, locale: "ko", body: imageDoc(trashed) })),
	];

	// ENT-CRT-14.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// ENT-CRT-14.2
	expect(await entryRows(POSTS)).toEqual([]);
	// ENT-CRT-14.3
	expect(await allUseRows()).toEqual([]);
});

it("ENT-CRT-15 관계 필드에 대상 컬렉션이 아닌 다른 컬렉션의 글은 연결할 수 없다", async () => {
	const page = await seedEntry({ collection: PAGES });

	// ENT-CRT-15.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", fields: { topic: page.id } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-15.2
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-16 슬러그 형식이 맞지 않으면 글을 만들 수 없다", async () => {
	// ENT-CRT-16.1
	await expect(
		montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello world" }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-CRT-16.2
	expect(await entryRows(POSTS)).toEqual([]);
});

it("ENT-CRT-17 같은 컬렉션과 언어에 같은 슬러그의 활성 글이 이미 있으면 글을 만들 수 없다", async () => {
	const existing = await seedEntry({ slug: "hello" });

	// ENT-CRT-17.1
	await expect(montiOf().entries.create({ collection: POSTS, locale: "ko", slug: "hello" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-CRT-17.2
	expect(rowIds(await entryRows(POSTS))).toEqual([existing.id]);
});

// ---- 2. 조회 ----

it("ENT-CRT-18 같은 컬렉션과 언어에 같은 슬러그로 글을 동시에 두 번 만들면 한 건만 성공하고 나머지는 거절된다", async () => {
	const input = { collection: POSTS, locale: "ko", slug: "same", fields: { title: "제목" } };

	// 첫 생성이 슬러그가 비어 있음을 확인한 직후 멈춘 동안 두 번째 생성이 시작된다.
	const [first, second] = await overlap(
		db,
		(hold) => heldMonti(SLUG_CHECK, hold).entries.create(input),
		() => montiOf().entries.create(input),
	);
	const same = (await dataRows(POSTS)).filter((row) => row.status === "draft" && row.slug === "same");

	// ENT-CRT-18.1
	expect([first.code, second.code].sort()).toEqual(["CONFLICT", null]);
	// ENT-CRT-18.2
	expect(same.filter((row) => row.locale === "ko")).toHaveLength(1);
});

it("ENT-READ-1 기본 단건 조회는 발행된 글의 원문 언어 발행본을 돌려준다", async () => {
	const { entry, published } = await seedPublishedEntry();

	const output = await montiOf().entries.get({ id: entry.id });

	// ENT-READ-1.1
	expect(output).toMatchObject({
		id: entry.id,
		collection: POSTS,
		source_locale: "ko",
		folder_id: null,
		locale: "ko",
	});
	// ENT-READ-1.2
	expect(output).toMatchObject({
		slug: published.slug,
		fields: { title: "Live" },
		published_at: PUBLISHED_AT,
	});
});

it("ENT-READ-2 컬렉션·언어·발행 슬러그로 발행본을 단건 조회한다", async () => {
	const topic = await seedEntry({ collection: TOPICS, columns: { name: "Draft" } });
	await seedCopy(TOPICS, topic.id, "ko", "published", { slug: "shared", columns: { name: "Live" } });
	// 컬렉션을 보지 않고 찾으면 먼저 나오는 `posts`에 같은 언어·발행 슬러그의 글이 있다.
	const post = await seedEntry({ columns: { title: "Draft" } });
	await seedCopy(POSTS, post.id, "ko", "published", { slug: "shared", columns: { title: "Live" } });

	const output = await montiOf().entries.get({ collection: TOPICS, locale: "ko", slug: "shared", status: "published" });

	// ENT-READ-2.1
	expect(output).toMatchObject({
		id: topic.id,
		slug: "shared",
		fields: { name: "Live" },
		published_at: PUBLISHED_AT,
	});
});

it("ENT-READ-3 초안 상태로 단건 조회하면 발행본이 있더라도 작업본을 돌려준다", async () => {
	const { entry } = await seedPublishedEntry();

	const output = await montiOf().entries.get({ id: entry.id, status: "draft" });

	// ENT-READ-3.1
	expect(output).toMatchObject({ slug: entry.slug, fields: { title: "Draft" } });
	// ENT-READ-3.2
	expect(output.published_at).toEqual(PUBLISHED_AT);
});

it("ENT-READ-4 아직 발행하지 않은 글은 기본 발행본 조회에서 찾을 수 없다", async () => {
	const entry = await seedEntry();

	// ENT-READ-4.1
	await expect(montiOf().entries.get({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("ENT-READ-5 휴지통에 있는 글은 초안 상태로도 조회할 수 없다", async () => {
	const { entry } = await seedPublishedEntry({ trashed: true });

	// ENT-READ-5.1
	await expect(montiOf().entries.get({ id: entry.id, status: "draft" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("ENT-READ-6 조건 없이 목록을 조회하면 활성 글의 발행된 원문 언어만 돌려준다", async () => {
	const { entry: both, published } = await seedPublishedEntry();
	await seedCopy(POSTS, both.id, "en", "draft");
	await seedCopy(POSTS, both.id, "en", "published");
	const onlyEn = await seedEntry();
	await seedCopy(POSTS, onlyEn.id, "en", "draft");
	await seedCopy(POSTS, onlyEn.id, "en", "published");
	await seedPublishedEntry({ trashed: true });

	const output = await montiOf().entries.list();

	// ENT-READ-6.1
	expect(idsAndLocales(output)).toEqual([{ id: both.id, locale: "ko" }]);
	// ENT-READ-6.2
	expect({ slug: output[0].slug, fields: output[0].fields, published_at: output[0].published_at }).toEqual({
		slug: published.slug,
		fields: { title: "Live" },
		published_at: PUBLISHED_AT,
	});
});

/** `gallery` 필드가 미디어 `id` 하나를 담는 `<collection>_rels` 행. */
function galleryOf(id: string): RelSeed[] {
	return [{ path: "gallery", column: "media_id", ids: [id] }];
}

it("ENT-READ-7 초안 상태로 목록을 조회하면 모든 활성 글의 원문 언어 작업본을 돌려준다", async () => {
	const [draftImage, liveImage, onlyDraftImage] = [await seedMedia(), await seedMedia(), await seedMedia()];
	const publishedEntry = await seedEntry({ columns: { title: "Draft" }, rels: galleryOf(draftImage) });
	await seedCopy(POSTS, publishedEntry.id, "ko", "published", {
		columns: { title: "Live" },
		rels: galleryOf(liveImage),
	});
	const unpublished = await seedEntry({ columns: { title: "Only draft" }, rels: galleryOf(onlyDraftImage) });
	await seedPublishedEntry({ trashed: true });

	const output = await montiOf().entries.list({ status: "draft" });
	const byId = new Map(output.map((entry) => [entry.id, entry]));

	// ENT-READ-7.1
	expect(output.map(({ id, fields }) => ({ id, fields })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
		[
			{ id: publishedEntry.id, fields: { title: "Draft", gallery: [draftImage] } },
			{ id: unpublished.id, fields: { title: "Only draft", gallery: [onlyDraftImage] } },
		].sort((a, b) => a.id.localeCompare(b.id)),
	);
	// ENT-READ-7.2
	expect(byId.get(publishedEntry.id)?.published_at).toEqual(PUBLISHED_AT);
	// ENT-READ-7.3
	expect(byId.get(unpublished.id)?.published_at).toBeNull();
});

it("ENT-READ-8 컬렉션·언어·폴더를 지정하면 모두 일치하는 해당 폴더 직속 글만 돌려준다", async () => {
	const folder = await seedFolder();
	const child = await seedFolder({ parent_id: folder });
	const direct = await seedEntry({ folder_id: folder });
	await seedEntry({ folder_id: child });
	await seedEntry({ folder_id: null });
	await seedEntry({ folder_id: folder, locale: "en" });
	await seedEntry({ collection: PAGES, folder_id: folder });

	const output = await montiOf().entries.list({ collection: POSTS, locale: "ko", folder_id: folder, status: "draft" });

	// ENT-READ-8.1
	expect(idsOf(output)).toEqual([direct.id]);
});

it("ENT-READ-9 폴더를 비워 목록을 조회하면 루트 글만 돌려준다", async () => {
	const root = await seedEntry({ folder_id: null });
	await seedEntry({ folder_id: await seedFolder() });

	const output = await montiOf().entries.list({ folder_id: null, status: "draft" });

	// ENT-READ-9.1
	expect(idsOf(output)).toEqual([root.id]);
});

it("ENT-READ-10 역방향 관계 조건으로 목록을 조회하면 해당 대상을 참조하는 글만 돌려준다", async () => {
	const target = await seedEntry({ collection: TOPICS });
	const other = await seedEntry({ collection: TOPICS });
	const post = await seedEntry({ columns: { topic: target.id } });
	await seedCopy(POSTS, post.id, "ko", "published", { columns: { topic: target.id } });
	const page = await seedEntry({ collection: PAGES, rels: [{ path: "topic", column: "topics_id", ids: [target.id] }] });
	await seedCopy(PAGES, page.id, "ko", "published", {
		rels: [{ path: "topic", column: "topics_id", ids: [other.id, target.id] }],
	});
	const draftOnly = await seedEntry({ columns: { topic: target.id } });
	await seedCopy(POSTS, draftOnly.id, "ko", "published", { columns: { topic: other.id } });

	const output = await montiOf().entries.list({ relation: { field: "topic", id: target.id } });

	// ENT-READ-10.1
	expect(idsOf(output)).toEqual(sortedIds([post.id, page.id]));
});

it("ENT-READ-11 비원문 언어를 지정해 단건 조회하면 해당 언어의 발행본을 돌려준다", async () => {
	const [koLive, enDraft, enLive] = [await seedMedia(), await seedMedia(), await seedMedia()];
	const entry = await seedEntry({ columns: { title: "Draft" } });
	await seedCopy(POSTS, entry.id, "ko", "published", { columns: { title: "Live" }, rels: galleryOf(koLive) });
	await seedCopy(POSTS, entry.id, "en", "draft", { columns: { title: "En draft" }, rels: galleryOf(enDraft) });
	const en = await seedCopy(POSTS, entry.id, "en", "published", {
		columns: { title: "En live" },
		rels: galleryOf(enLive),
		published_at: new Date("2026-11-05T00:00:00.000Z"),
	});

	const output = await montiOf().entries.get({ id: entry.id, locale: "en" });

	// ENT-READ-11.1
	expect(output).toMatchObject({ id: entry.id, locale: "en", source_locale: "ko" });
	// ENT-READ-11.2
	expect(output).toMatchObject({
		slug: en.slug,
		fields: { title: "En live", gallery: [enLive] },
		published_at: en.published_at,
	});
});

it("ENT-READ-12 글에 없는 언어를 지정하면 조회할 수 없다", async () => {
	const entry = await seedEntry();

	// ENT-READ-12.1
	await expect(montiOf().entries.get({ id: entry.id, locale: "en", status: "draft" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

it("ENT-READ-13 언어를 생략해 목록을 조회하면 번역 언어가 있어도 글마다 원문 언어 한 행씩만 돌려준다", async () => {
	const ko = await seedEntry();
	await seedCopy(POSTS, ko.id, "en", "draft");
	const en = await seedEntry({ locale: "en" });

	const output = await montiOf().entries.list({ status: "draft" });

	// ENT-READ-13.1
	expect(idsAndLocales(output)).toEqual(
		idsAndLocales([
			{ id: ko.id, locale: "ko" },
			{ id: en.id, locale: "en" },
		]),
	);
});

it("ENT-READ-14 발행본 조회에서는 휴지통에 들어간 미디어나 글을 가리키는 참조가 빠진다", async () => {
	const media = await seedMedia();
	const first = await seedEntry({ collection: TOPICS });
	const second = await seedEntry({ collection: TOPICS });
	const references = {
		columns: { cover: media },
		rels: [{ path: "related", column: "topics_id", ids: [first.id, second.id] }],
	};
	const entry = await seedEntry(references);
	await seedCopy(POSTS, entry.id, "ko", "published", references);
	await trashMedia(media);
	await trashEntry(TOPICS, first.id);

	const output = await montiOf().entries.get({ id: entry.id });

	// ENT-READ-14.1
	expect(output.fields).toStrictEqual({ related: [second.id] });
});

it("ENT-READ-15 초안 조회에서는 휴지통에 들어간 미디어나 글을 가리키는 참조도 그대로 보인다", async () => {
	const media = await seedMedia();
	const first = await seedEntry({ collection: TOPICS });
	const second = await seedEntry({ collection: TOPICS });
	const entry = await seedEntry({
		columns: { cover: media },
		rels: [{ path: "related", column: "topics_id", ids: [first.id, second.id] }],
	});
	await trashMedia(media);
	await trashEntry(TOPICS, first.id);

	const output = await montiOf().entries.get({ id: entry.id, status: "draft" });

	// ENT-READ-15.1
	expect(output.fields).toEqual({ cover: media, related: [first.id, second.id] });
});

it("ENT-READ-16 스키마에 없는 컬렉션으로는 글을 조회할 수 없다", async () => {
	const monti = montiOf({ locales: SCHEMA.locales, collections: { [POSTS]: SCHEMA.collections[POSTS] } });

	const codes = [
		await codeOf(monti.entries.get({ collection: "unknown", locale: "ko", slug: "hello" })),
		await codeOf(monti.entries.list({ collection: "unknown" })),
	];

	// ENT-READ-16.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
});

// ---- 3. 수정 ----

it("ENT-UPD-1 단건 수정에서 필드·본문 없이 슬러그와 폴더만 주면 지정한 항목만 바꾸고 필드·본문·미디어 사용처·발행본은 유지한다", async () => {
	const media = await seedMedia();
	const folder = await seedFolder();
	const { entry, use } = await seedEntryUsing(media, { columns: { title: "Draft" } });
	const published = await seedCopy(POSTS, entry.id, "ko", "published", { columns: { title: "Live", cover: media } });

	const output = (await montiOf().entries.update({ id: entry.id, slug: "renamed", folder_id: folder })) as Entry;

	// ENT-UPD-1.1
	expect(output).toMatchObject({
		slug: "renamed",
		folder_id: folder,
		fields: { title: "Draft", cover: media },
		published_at: PUBLISHED_AT,
	});
	// ENT-UPD-1.2
	expect({
		folder_id: (await entryRow(POSTS, entry.id)).folder_id,
		draft: await dataRow(POSTS, entry.id, "ko", "draft"),
	}).toMatchObject({ folder_id: folder, draft: { slug: "renamed", title: "Draft", cover: media } });
	// ENT-UPD-1.3
	expect(await useRows("entry", entry.id)).toEqual([use]);
	// ENT-UPD-1.4
	expect(await dataRow(POSTS, entry.id, "ko", "published")).toMatchObject({
		slug: published.slug,
		title: "Live",
		cover: media,
	});
});

it("ENT-UPD-2 단건 수정에서 필드나 본문을 바꾸면 작업본을 교체하고 해당 글의 미디어 사용처만 갱신한다", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const folder = await seedFolder();
	const target = await seedEntryUsing(first, { columns: { title: "Old" }, folder_id: folder });
	const other = await seedEntryUsing(first);
	const templateUse = await seedUse({
		media_id: first,
		source_kind: "template",
		source_id: target.entry.id,
		field_path: "content",
	});
	const fields = { cover: second };

	const output = (await montiOf().entries.update({ id: target.entry.id, fields })) as Entry;

	// ENT-UPD-2.1
	expect(output).toMatchObject({ fields, slug: target.entry.slug, folder_id: folder });
	// ENT-UPD-2.2
	expect(await dataRow(POSTS, target.entry.id, "ko", "draft")).toMatchObject({ cover: second, title: null });
	// ENT-UPD-2.3
	expect(await useRows("entry", target.entry.id)).toEqual([coverUse(target.entry.id, second)]);
	// ENT-UPD-2.4
	expect(await useRows("entry", other.entry.id)).toEqual([other.use]);
	// ENT-UPD-2.5
	expect(await useRows("template", target.entry.id)).toEqual([templateUse]);
});

it("ENT-UPD-3 단건 수정에서 폴더를 비우면 글을 루트로 이동한다", async () => {
	const entry = await seedEntry({ folder_id: await seedFolder() });

	const output = (await montiOf().entries.update({ id: entry.id, folder_id: null })) as Entry;

	// ENT-UPD-3.1
	expect(output.folder_id).toBeNull();
	// ENT-UPD-3.2
	expect((await entryRow(POSTS, entry.id)).folder_id).toBeNull();
});

it("ENT-UPD-4 단건 수정에서 존재하지 않거나 기존에 없던 휴지통 미디어를 필드나 본문에 새로 넣으면 수정을 거절하고 기존 상태를 유지한다", async () => {
	const media = await seedMedia();
	const trashed = await seedMedia(true);
	const { entry, use } = await seedEntryUsing(media);
	const before = await dataRow(POSTS, entry.id, "ko", "draft");

	const codes = [
		await codeOf(montiOf().entries.update({ id: entry.id, fields: { cover: randomUUID() } })),
		await codeOf(montiOf().entries.update({ id: entry.id, body: imageDoc(trashed) })),
	];

	// ENT-UPD-4.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// ENT-UPD-4.2
	expect(await dataRow(POSTS, entry.id, "ko", "draft")).toEqual(before);
	// ENT-UPD-4.3
	expect(await useRows("entry", entry.id)).toEqual([use]);
});

it("ENT-UPD-5 단건 수정에서 기존에 없던 휴지통 글을 관계 필드에 새로 연결하려 하면 거절한다", async () => {
	const entry = await seedEntry();
	const trashed = await seedEntry({ collection: TOPICS, trashed: true });
	const before = await dataRow(POSTS, entry.id, "ko", "draft");

	// ENT-UPD-5.1
	await expect(montiOf().entries.update({ id: entry.id, fields: { topic: trashed.id } })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-UPD-5.2
	expect(await dataRow(POSTS, entry.id, "ko", "draft")).toEqual(before);
});

it("ENT-UPD-6 휴지통에 있는 글은 수정할 수 없다", async () => {
	const entry = await seedEntry({ trashed: true });

	// ENT-UPD-6.1
	await expect(montiOf().entries.update({ id: entry.id, slug: "renamed" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UPD-6.2
	expect((await dataRow(POSTS, entry.id, "ko", "draft"))?.slug).toBe(entry.slug);
});

it("ENT-UPD-7 같은 컬렉션과 언어의 다른 활성 글과 슬러그가 겹치면 슬러그를 바꿀 수 없다", async () => {
	const first = await seedEntry();
	const second = await seedEntry();

	// ENT-UPD-7.1
	await expect(montiOf().entries.update({ id: second.id, slug: first.slug ?? "" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-UPD-7.2
	expect((await dataRow(POSTS, second.id, "ko", "draft"))?.slug).toBe(second.slug);
});

it("ENT-UPD-8 다건 수정은 지정한 글들을 한 폴더로 일괄 이동한다", async () => {
	const first = await seedEntry();
	const second = await seedEntry();
	const folder = await seedFolder();

	const output = (await montiOf().entries.update({ ids: [first.id, second.id], folder_id: folder })) as {
		id: string;
		folder_id: string | null;
	}[];

	// ENT-UPD-8.1
	expect([...output].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
		[
			{ id: first.id, folder_id: folder },
			{ id: second.id, folder_id: folder },
		].sort((a, b) => a.id.localeCompare(b.id)),
	);
	// ENT-UPD-8.2
	expect((await entryRows(POSTS)).map((row) => row.folder_id)).toEqual([folder, folder]);
});

it("ENT-UPD-9 다건 수정 대상 중 하나라도 휴지통에 있으면 전체 이동을 취소한다", async () => {
	const active = await seedEntry();
	const trashed = await seedEntry({ trashed: true });
	const folder = await seedFolder();

	// ENT-UPD-9.1
	await expect(montiOf().entries.update({ ids: [active.id, trashed.id], folder_id: folder })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UPD-9.2
	expect((await entryRow(POSTS, active.id)).folder_id).toBeNull();
});

it("ENT-UPD-10 다건 수정에서 이동할 폴더가 휴지통에 있으면 전체 이동을 취소한다", async () => {
	const first = await seedEntry();
	const second = await seedEntry();
	const folder = await seedFolder({ trashed: true });

	// ENT-UPD-10.1
	await expect(montiOf().entries.update({ ids: [first.id, second.id], folder_id: folder })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-UPD-10.2
	expect((await entryRows(POSTS)).map((row) => row.folder_id)).toEqual([null, null]);
});

it("ENT-UPD-11 비원문 언어를 지정해 수정하면 그 언어의 작업본만 바꾸고 폴더는 글 전체에 적용한다", async () => {
	const entry = await seedEntry({ columns: { title: "Ko" } });
	await seedCopy(POSTS, entry.id, "en", "draft", { columns: { title: "En" } });
	const ko = await dataRow(POSTS, entry.id, "ko", "draft");
	const folder = await seedFolder();
	const fields = { title: "New en" };

	const output = (await montiOf().entries.update({
		id: entry.id,
		locale: "en",
		slug: "new-en",
		folder_id: folder,
		fields,
	})) as Entry;

	// ENT-UPD-11.1
	expect(output).toMatchObject({ locale: "en", source_locale: "ko", slug: "new-en", folder_id: folder, fields });
	// ENT-UPD-11.2
	expect({
		en: await dataRow(POSTS, entry.id, "en", "draft"),
		ko: await dataRow(POSTS, entry.id, "ko", "draft"),
	}).toMatchObject({ en: { slug: "new-en", title: "New en" }, ko });
	// ENT-UPD-11.3
	expect((await entryRow(POSTS, entry.id)).folder_id).toBe(folder);
});

it("ENT-UPD-12 한 언어의 데이터를 바꿔도 같은 글의 다른 언어가 참조하는 미디어 사용처는 유지한다", async () => {
	const [first, second, third] = [await seedMedia(), await seedMedia(), await seedMedia()];
	const { entry } = await seedEntryUsing(first);
	await seedCopy(POSTS, entry.id, "en", "draft", { columns: { cover: second } });
	await seedUse(coverUse(entry.id, second));

	await montiOf().entries.update({ id: entry.id, locale: "en", fields: { cover: third } });

	// ENT-UPD-12.1
	expect((await useRows("entry", entry.id)).map((use) => use.media_id).sort()).toEqual(sortedIds([first, third]));
});

it("ENT-UPD-13 글에 없는 언어를 지정하면 수정할 수 없다", async () => {
	const entry = await seedEntry();
	const before = await dataRow(POSTS, entry.id, "ko", "draft");

	// ENT-UPD-13.1
	await expect(montiOf().entries.update({ id: entry.id, locale: "en", slug: "renamed" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UPD-13.2
	expect(await dataRow(POSTS, entry.id, "ko", "draft")).toEqual(before);
});

it("ENT-UPD-14 작업본에 이미 있던 참조는 대상이 휴지통에 들어가도 그대로 둔 채 다른 항목을 고쳐 저장할 수 있다", async () => {
	const media = await seedMedia();
	const topic = await seedEntry({ collection: TOPICS });
	/** 문단 하나와 그 미디어를 참조하는 이미지 블록 하나로 된 본문. */
	const bodyWith = (text: string) => ({
		blocks: [
			{ id: "p1", type: "paragraph", content: [{ type: "text", text }] },
			{ id: "i1", type: "image", attrs: { mediaId: media } },
		],
	});
	const entry = await seedEntry({
		columns: { title: "Old", cover: media, body: JSON.stringify(bodyWith("Old")) },
		rels: [{ path: "related", column: "topics_id", ids: [topic.id] }],
	});
	const uses = [
		await seedUse({ media_id: media, source_kind: "entry", source_id: entry.id, field_path: "body" }),
		await seedUse(coverUse(entry.id, media)),
	];
	await trashMedia(media);
	await trashEntry(TOPICS, topic.id);
	const fields = { title: "New", cover: media, related: [topic.id] };

	const output = (await montiOf().entries.update({ id: entry.id, fields, body: bodyWith("New") })) as Entry;

	// ENT-UPD-14.1
	expect({ fields: output.fields, body: output.body }).toEqual({ fields, body: bodyWith("New") });
	// ENT-UPD-14.2
	expect(await useRows("entry", entry.id)).toEqual(uses);
	// ENT-UPD-14.3
	expect({
		cover: (await dataRow(POSTS, entry.id, "ko", "draft"))?.cover,
		related: (await relsRows(POSTS, entry.id, "topics_id")).map((rel) => rel.id),
	}).toEqual({ cover: media, related: [topic.id] });
});

it("ENT-UPD-15 단건 수정에서 슬러그를 빈 문자열로 바꿀 수 없다", async () => {
	const entry = await seedEntry({ slug: "hello" });

	// ENT-UPD-15.1
	await expect(montiOf().entries.update({ id: entry.id, slug: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-UPD-15.2
	expect((await dataRow(POSTS, entry.id, "ko", "draft"))?.slug).toBe("hello");
});

it("ENT-UPD-16 단건 수정에서 필드만 바꾸면 본문이 유지되고 본문만 바꾸면 필드가 유지된다", async () => {
	const entry = await seedEntry({ columns: { title: "Old", body: JSON.stringify(PLAIN) } });
	const fields = { title: "New" };
	const body = { blocks: [{ id: "p2", type: "paragraph", content: [{ type: "text", text: "Bye" }] }] };

	const first = (await montiOf().entries.update({ id: entry.id, fields })) as Entry;
	const second = (await montiOf().entries.update({ id: entry.id, body })) as Entry;

	// ENT-UPD-16.1
	expect({ fields: first.fields, body: first.body }).toEqual({ fields, body: PLAIN });
	// ENT-UPD-16.2
	expect({ fields: second.fields, body: second.body }).toEqual({ fields, body });
});

it("ENT-UPD-17 단건 수정에서 다른 범위나 휴지통의 폴더로 옮길 수 없고, 다건 수정에서는 폴더를 비워 루트로 옮길 수 있다", async () => {
	const folder = await seedFolder();
	const [first, second] = [await seedEntry({ folder_id: folder }), await seedEntry({ folder_id: folder })];
	const mediaFolder = await seedFolder({ scope: "media" });
	const monti = montiOf();

	const code = await codeOf(monti.entries.update({ id: first.id, folder_id: mediaFolder }));
	const unmoved = (await entryRow(POSTS, first.id)).folder_id;
	await monti.entries.update({ ids: [first.id, second.id], folder_id: null });

	// ENT-UPD-17.1
	expect({ code, folder_id: unmoved }).toEqual({ code: "BAD_REQUEST", folder_id: folder });
	// ENT-UPD-17.2
	expect([(await entryRow(POSTS, first.id)).folder_id, (await entryRow(POSTS, second.id)).folder_id]).toEqual([
		null,
		null,
	]);
});

it("ENT-UPD-18 필드와 본문을 보내지 않고 슬러그나 폴더만 바꿀 때는 기존 필드와 본문을 다시 검사하지 않는다", async () => {
	const media = await seedMedia();
	const entry = await seedEntry({ columns: { title: "제목", body: JSON.stringify(imageDoc(media)) } });
	// 미디어를 휴지통에서 영구 삭제했다: `media` 행이 없다.
	await db.deleteFrom("media").where("id", "=", media).execute();

	// ENT-UPD-18.1
	await expect(montiOf().entries.update({ id: entry.id, slug: "renamed" })).resolves.toMatchObject({ slug: "renamed" });
});

// ---- 4. 발행 ----

/** 필수 필드를 모두 채운 `notes` 작업본. */
const FILLED_NOTE = { title: "Note", rank: 0, pinned: false, labels: ["a"] };

it("ENT-UPD-19 서로 다른 두 글의 작업본 슬러그를 같은 값으로 동시에 바꾸면 한 건만 성공하고 나머지는 거절된다", async () => {
	const [one, two] = [await seedEntry({ slug: "one" }), await seedEntry({ slug: "two" })];

	// 첫 수정이 새 슬러그가 비어 있음을 확인한 직후 멈춘 동안 두 번째 수정이 시작된다.
	const [first, second] = await overlap(
		db,
		(hold) => heldMonti(SLUG_CHECK, hold).entries.update({ id: one.id, slug: "same" }),
		() => montiOf().entries.update({ id: two.id, slug: "same" }),
	);
	const same = (await dataRows(POSTS)).filter((row) => row.status === "draft" && row.slug === "same");

	// ENT-UPD-19.1
	expect([first.code, second.code].sort()).toEqual(["CONFLICT", null]);
	// ENT-UPD-19.2
	expect(same.filter((row) => row.locale === "ko")).toHaveLength(1);
});

it("ENT-UPD-20 같은 글의 필드와 본문을 동시에 각각 수정해도 두 변경이 모두 남고 미디어 사용처가 일치한다", async () => {
	const media = await seedMedia();
	const entry = await seedEntry({ columns: { title: "옛 제목" } });

	// 필드 수정이 작업본을 읽은 직후 멈춘 동안 본문 수정이 작업본을 읽고 저장한다.
	const [fields, body] = await overlap(
		db,
		(hold) => heldMonti(DRAFT_READ, hold).entries.update({ id: entry.id, fields: { title: "새 제목" } }),
		() => montiOf().entries.update({ id: entry.id, body: imageDoc(media) }),
	);
	const draft = await dataRow(POSTS, entry.id, "ko", "draft");
	const uses = await db.selectFrom("media_uses").selectAll().where("source_id", "=", entry.id).execute();

	// ENT-UPD-20.1
	expect([fields.code, body.code]).toEqual([null, null]);
	// ENT-UPD-20.2
	expect({ title: draft?.title, body: draft?.body }).toEqual({ title: "새 제목", body: imageDoc(media) });
	// ENT-UPD-20.3
	expect(uses.filter((use) => use.field_path === "body")).toEqual([
		{ media_id: media, source_kind: "entry", source_id: entry.id, field_path: "body" },
	]);
});

it("ENT-UPD-21 같은 글의 서로 다른 두 언어를 동시에 수정해도 두 언어 내용과 미디어 사용처가 모두 남는다", async () => {
	const [first, second] = [await seedMedia(), await seedMedia()];
	const entry = await seedEntry();
	await seedCopy(POSTS, entry.id, "en", "draft");

	// `ko` 수정이 작업본을 읽은 직후 멈춘 동안 `en` 수정이 작업본을 읽고 저장한다.
	const [ko, en] = await overlap(
		db,
		(hold) => heldMonti(DRAFT_READ, hold).entries.update({ id: entry.id, fields: { cover: first } }),
		() => montiOf().entries.update({ id: entry.id, locale: "en", fields: { cover: second } }),
	);
	const covers = [
		(await dataRow(POSTS, entry.id, "ko", "draft"))?.cover,
		(await dataRow(POSTS, entry.id, "en", "draft"))?.cover,
	];
	const uses = await db.selectFrom("media_uses").select("media_id").where("source_id", "=", entry.id).execute();

	// ENT-UPD-21.1
	expect([ko.code, en.code]).toEqual([null, null]);
	// ENT-UPD-21.2
	expect(covers).toEqual([first, second]);
	// ENT-UPD-21.3
	expect(uses.map((use) => use.media_id).sort()).toEqual([first, second].sort());
});

it("ENT-UPD-22 글을 휴지통에 보내는 동안 그 글을 수정해도 휴지통에 들어간 글의 작업본과 미디어 사용처가 지워지지 않는다", async () => {
	const media = await seedMedia();
	const { entry, use } = await seedEntryUsing(media, { columns: { title: "옛 제목" } });
	const draft = await dataRow(POSTS, entry.id, "ko", "draft");

	// 수정이 작업본을 읽은 직후 멈춘 동안 휴지통 이동이 커밋된다.
	const [update, move] = await overlap(
		db,
		(hold) => heldMonti(DRAFT_READ, hold).entries.update({ id: entry.id, fields: { title: "새 제목", cover: media } }),
		() => heldMonti().trash.move({ id: entry.id }),
		{ commits: true },
	);
	const uses = await db.selectFrom("media_uses").selectAll().where("source_id", "=", entry.id).execute();

	// ENT-UPD-22.1
	expect({ code: move.code, trashed: (await entryRow(POSTS, entry.id)).trashed_at !== null }).toEqual({
		code: null,
		trashed: true,
	});
	// ENT-UPD-22.2
	expect(update.code).toBe("NOT_FOUND");
	// ENT-UPD-22.3
	expect({ draft: await dataRow(POSTS, entry.id, "ko", "draft"), uses }).toEqual({ draft, uses: [use] });
});

it("ENT-PUB-1 슬러그와 필수 필드가 채워진 작업본으로 발행본을 만든다", async () => {
	// 스키마에 있는 분기를 고른 조건부 필드도 함께 채운다.
	const columns = { ...FILLED_NOTE, kind: "plain", kind__plain__note: "메모" };
	const fields = { ...FILLED_NOTE, kind: { option: "plain", fields: { note: "메모" } } };
	const entry = await seedEntry({ collection: NOTES, slug: "note", columns });
	const before = new Date();

	const output = await montiOf().entries.publish({ id: entry.id });

	const after = new Date();
	// ENT-PUB-1.1
	expect({
		slug: output.slug,
		fields: output.fields,
		inRange: output.published_at !== null && output.published_at >= before && output.published_at <= after,
	}).toEqual({ slug: "note", fields, inRange: true });
	// ENT-PUB-1.2
	expect(await dataRow(NOTES, entry.id, "ko", "published")).toMatchObject({
		slug: "note",
		...columns,
		published_at: output.published_at,
	});
});

it("ENT-PUB-2 이미 발행된 글을 다시 발행하면 기존 발행 시각을 유지한다", async () => {
	const entry = await seedEntry({ collection: NOTES, slug: "new", columns: { ...FILLED_NOTE, title: "New" } });
	await seedCopy(NOTES, entry.id, "ko", "published", { slug: "old", columns: FILLED_NOTE });

	const output = await montiOf().entries.publish({ id: entry.id });

	// ENT-PUB-2.1
	expect(output).toMatchObject({
		slug: "new",
		fields: { ...FILLED_NOTE, title: "New" },
		published_at: PUBLISHED_AT,
	});
	// ENT-PUB-2.2
	expect(await dataRow(NOTES, entry.id, "ko", "published")).toMatchObject({
		slug: "new",
		title: "New",
		published_at: PUBLISHED_AT,
	});
});

it("ENT-PUB-3 발행 시각을 지정해 발행하면 그 시각으로 저장한다", async () => {
	const entry = await seedEntry({ collection: NOTES, slug: "note", columns: FILLED_NOTE });
	await seedCopy(NOTES, entry.id, "ko", "published", { slug: "note", columns: FILLED_NOTE });
	const at = "2026-12-25T10:00:00+09:00";

	const output = await montiOf().entries.publish({ id: entry.id, published_at: at });

	// ENT-PUB-3.1
	expect(output.published_at).toEqual(new Date(at));
	// ENT-PUB-3.2
	expect((await dataRow(NOTES, entry.id, "ko", "published"))?.published_at).toEqual(new Date(at));
});

it("ENT-PUB-4 슬러그가 비어 있으면 글을 발행할 수 없다", async () => {
	const entry = await seedEntry({ collection: NOTES, slug: null, columns: FILLED_NOTE });

	// ENT-PUB-4.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-PUB-4.2
	expect(await dataRow(NOTES, entry.id, "ko", "published")).toBeUndefined();
});

it("ENT-PUB-5 필수 필드가 비어 있으면 글을 발행할 수 없다", async () => {
	const notes = [
		// 필수 `text` 필드 `title`을 생략했다.
		await seedEntry({ collection: NOTES, columns: { rank: 0, pinned: false, labels: ["a"] } }),
		await seedEntry({ collection: NOTES, columns: { ...FILLED_NOTE, title: "" } }),
		await seedEntry({ collection: NOTES, columns: { ...FILLED_NOTE, labels: [] } }),
	];
	const monti = montiOf();

	const codes: (string | null)[] = [];
	for (const note of notes) codes.push(await codeOf(monti.entries.publish({ id: note.id })));

	// ENT-PUB-5.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
	// ENT-PUB-5.2
	expect((await dataRows(NOTES)).filter((row) => row.status === "published")).toEqual([]);
});

it("ENT-PUB-6 선택한 조건부 분기의 필수 하위 필드가 비어 있으면 글을 발행할 수 없다", async () => {
	const entry = await seedEntry({ collection: NOTES, columns: { ...FILLED_NOTE, kind: "link" } });

	// ENT-PUB-6.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-PUB-6.2
	expect(await dataRow(NOTES, entry.id, "ko", "published")).toBeUndefined();
});

it("ENT-PUB-7 같은 슬러그로 이미 발행된 다른 활성 글이 있으면 발행할 수 없다", async () => {
	const first = await seedEntry({ collection: NOTES, slug: "renamed", columns: FILLED_NOTE });
	await seedCopy(NOTES, first.id, "ko", "published", { slug: "old", columns: FILLED_NOTE });
	const second = await seedEntry({ collection: NOTES, slug: "old", columns: FILLED_NOTE });

	// ENT-PUB-7.1
	await expect(montiOf().entries.publish({ id: second.id })).rejects.toMatchObject({ code: "CONFLICT" });
	// ENT-PUB-7.2
	expect((await dataRows(NOTES)).filter((row) => row.status === "published")).toMatchObject([
		{ entry_id: first.id, slug: "old" },
	]);
});

it("ENT-PUB-8 휴지통에 있는 글은 발행할 수 없다", async () => {
	const entry = await seedEntry({ collection: NOTES, slug: "note", columns: FILLED_NOTE, trashed: true });

	// ENT-PUB-8.1
	await expect(montiOf().entries.publish({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// ENT-PUB-8.2
	expect(await dataRow(NOTES, entry.id, "ko", "published")).toBeUndefined();
});

it("ENT-PUB-9 비원문 언어를 지정해 발행하면 그 언어의 발행본만 만들고 원문 언어는 건드리지 않는다", async () => {
	const entry = await seedEntry({ collection: NOTES, slug: "ko-note", columns: FILLED_NOTE });
	const en = { ...FILLED_NOTE, title: "En" };
	await seedCopy(NOTES, entry.id, "en", "draft", { slug: "en-note", columns: en });

	const output = await montiOf().entries.publish({ id: entry.id, locale: "en" });

	// ENT-PUB-9.1
	expect(output).toMatchObject({ locale: "en", source_locale: "ko", slug: "en-note", fields: en });
	// ENT-PUB-9.2
	expect((await dataRows(NOTES, entry.id)).filter((row) => row.status === "published")).toMatchObject([
		{ locale: "en" },
	]);
});

it("ENT-PUB-10 글에 없는 언어를 지정하면 발행할 수 없다", async () => {
	const entry = await seedEntry({ collection: NOTES, slug: "note", columns: FILLED_NOTE });

	// ENT-PUB-10.1
	await expect(montiOf().entries.publish({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-PUB-10.2
	expect((await dataRows(NOTES, entry.id)).filter((row) => row.status === "published")).toEqual([]);
});

it("ENT-PUB-11 참조 필드나 본문이 가리키던 대상이 휴지통에 들어가 있으면 필수 여부와 관계없이 발행할 수 없다", async () => {
	const topic = await seedEntry({ collection: TOPICS });
	const lostTopic = await seedEntry({ collection: TOPICS });
	const cover = await seedMedia();
	const image = await seedMedia();
	const optional = await seedEntry({ collection: CARDS, slug: "optional", columns: { topic: topic.id, cover } });
	const required = await seedEntry({ collection: CARDS, slug: "required", columns: { topic: lostTopic.id } });
	const post = await seedEntry({ slug: "post", columns: { title: "제목", body: JSON.stringify(imageDoc(image)) } });
	await trashMedia(cover);
	await trashEntry(TOPICS, lostTopic.id);
	await trashMedia(image);

	const codes = [
		await codeOf(montiOf().entries.publish({ id: optional.id })),
		await codeOf(montiOf().entries.publish({ id: required.id })),
		await codeOf(montiOf().entries.publish({ id: post.id })),
	];

	// ENT-PUB-11.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
	// ENT-PUB-11.2
	expect([...(await dataRows(CARDS)), ...(await dataRows(POSTS))].filter((row) => row.status === "published")).toEqual(
		[],
	);
});

/** `notes`의 조건부 필드 `kind`에서 `plain` 분기만 지운 스키마. */
const WITHOUT_PLAIN: Schema = {
	...SCHEMA,
	collections: {
		...SCHEMA.collections,
		[NOTES]: {
			fields: {
				...SCHEMA.collections[NOTES].fields,
				kind: {
					type: "conditional",
					options: {
						link: { fields: { url: { type: "text", required: true }, topic: { type: "relation", to: TOPICS } } },
					},
				},
			},
		},
	},
};

it("ENT-PUB-13 조건부 필드에 스키마에서 사라진 분기가 저장되어 있으면 발행할 수 없다", async () => {
	const entry = await seedEntry({
		collection: NOTES,
		slug: "note",
		columns: { ...FILLED_NOTE, kind: "plain", kind__plain__note: "메모" },
	});
	await syncSchemaTables(testDb.db, WITHOUT_PLAIN);

	// ENT-PUB-13.1
	await expect(montiOf(WITHOUT_PLAIN).entries.publish({ id: entry.id })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-PUB-13.2
	expect(await dataRow(NOTES, entry.id, "ko", "published")).toBeUndefined();
});

// ---- 5. 발행 취소 ----

it("ENT-UNPUB-1 발행을 취소하면 발행본만 지우고 작업본과 미디어 사용처는 남긴다", async () => {
	const media = await seedMedia();
	const { entry, use } = await seedEntryUsing(media, { columns: { title: "Draft" } });
	await seedCopy(POSTS, entry.id, "ko", "published", { columns: { cover: media } });
	const draft = await dataRow(POSTS, entry.id, "ko", "draft");

	const output = await montiOf().entries.unpublish({ id: entry.id });

	// ENT-UNPUB-1.1
	expect(output).toMatchObject({
		slug: entry.slug,
		fields: { title: "Draft", cover: media },
		published_at: null,
	});
	// ENT-UNPUB-1.2
	expect(await dataRow(POSTS, entry.id, "ko", "published")).toBeUndefined();
	// ENT-UNPUB-1.3
	expect(await dataRow(POSTS, entry.id, "ko", "draft")).toEqual(draft);
	// ENT-UNPUB-1.4
	expect(await useRows("entry", entry.id)).toEqual([use]);
});

it("ENT-UNPUB-2 이미 미발행 상태인 글도 오류 없이 발행 취소된다", async () => {
	const entry = await seedEntry({ columns: { title: "Draft" } });

	const output = await montiOf().entries.unpublish({ id: entry.id });

	// ENT-UNPUB-2.1
	expect(output).toMatchObject({
		id: entry.id,
		slug: entry.slug,
		fields: { title: "Draft" },
		published_at: null,
	});
});

it("ENT-UNPUB-3 휴지통에 있는 글은 발행을 취소할 수 없다", async () => {
	const { entry, published } = await seedPublishedEntry({ trashed: true });

	// ENT-UNPUB-3.1
	await expect(montiOf().entries.unpublish({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// ENT-UNPUB-3.2
	expect(await dataRow(POSTS, entry.id, "ko", "published")).toMatchObject({
		slug: published.slug,
		published_at: PUBLISHED_AT,
	});
});

it("ENT-UNPUB-4 비원문 언어를 지정해 발행을 취소하면 그 언어의 발행본만 지우고 다른 언어 발행본은 유지한다", async () => {
	const { entry } = await seedPublishedEntry();
	await seedCopy(POSTS, entry.id, "en", "draft");
	await seedCopy(POSTS, entry.id, "en", "published");

	const output = await montiOf().entries.unpublish({ id: entry.id, locale: "en" });

	// ENT-UNPUB-4.1
	expect(output).toMatchObject({ locale: "en", published_at: null });
	// ENT-UNPUB-4.2
	expect((await dataRows(POSTS, entry.id)).filter((row) => row.status === "published")).toMatchObject([
		{ locale: "ko" },
	]);
});

it("ENT-UNPUB-5 글에 없는 언어를 지정하면 발행을 취소할 수 없다", async () => {
	const { entry } = await seedPublishedEntry();

	// ENT-UNPUB-5.1
	await expect(montiOf().entries.unpublish({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-UNPUB-5.2
	expect((await dataRows(POSTS, entry.id)).filter((row) => row.status === "published")).toMatchObject([
		{ locale: "ko" },
	]);
});

// ---- 6. 복제 ----

it("ENT-DUP-1 글의 원문 언어 작업본과 미디어 사용처를 새 슬러그의 미발행 글로 복제하고 번역 언어는 복제하지 않는다", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const folder = await seedFolder();
	const { entry } = await seedEntryUsing(first, { folder_id: folder, columns: { title: "Draft" } });
	await seedCopy(POSTS, entry.id, "ko", "published", { columns: { title: "Live", cover: first } });
	await seedCopy(POSTS, entry.id, "en", "draft", { columns: { cover: second } });
	await seedUse(coverUse(entry.id, second));
	const original = { entry: await entryRow(POSTS, entry.id), data: await dataRows(POSTS, entry.id) };

	const output = await montiOf().entries.duplicate({ id: entry.id, slug: "copy" });

	// ENT-DUP-1.1
	expect({ ...output, id: UUID.test(output.id) && output.id !== entry.id }).toEqual({
		id: true,
		collection: POSTS,
		locale: "ko",
		source_locale: "ko",
		folder_id: folder,
		slug: "copy",
		fields: { title: "Draft", cover: first },
		published_at: null,
	});
	// ENT-DUP-1.2
	expect({ entries: (await entryRows(POSTS)).length, data: await dataRows(POSTS, output.id) }).toMatchObject({
		entries: 2,
		data: [{ locale: "ko", status: "draft", slug: "copy", translation_seen: {} }],
	});
	// ENT-DUP-1.3
	expect({ entry: await entryRow(POSTS, entry.id), data: await dataRows(POSTS, entry.id) }).toEqual(original);
	// ENT-DUP-1.4
	expect(await dataRow(POSTS, output.id, "ko", "published")).toBeUndefined();
	// ENT-DUP-1.5
	expect(await useRows("entry", output.id)).toEqual([coverUse(output.id, first)]);
});

it("ENT-DUP-2 슬러그를 생략하고 복제하면 겹치지 않는 `-copy` 슬러그를 붙이고 원본 슬러그가 비어 있으면 비워 둔다", async () => {
	const hello = await seedEntry({ slug: "hello" });
	await seedEntry({ slug: "hello-copy" });
	await seedEntry({ slug: "hello-copy-2" });
	const untitled = await seedEntry({ slug: null });
	const monti = montiOf();

	const first = await monti.entries.duplicate({ id: hello.id });
	const second = await monti.entries.duplicate({ id: untitled.id });

	// ENT-DUP-2.1
	expect({ slug: first.slug, row: await dataRow(POSTS, first.id, "ko", "draft") }).toMatchObject({
		slug: "hello-copy-3",
		row: { slug: "hello-copy-3" },
	});
	// ENT-DUP-2.2
	expect(second.slug).toBeNull();
});

it("ENT-DUP-3 지정한 ID로 복제한다", async () => {
	const entry = await seedEntry();
	const id = randomUUID();

	const output = await montiOf().entries.duplicate({ id: entry.id, __preset_id: id });

	// ENT-DUP-3.1
	expect(output.id).toBe(id);
	// ENT-DUP-3.2
	expect(rowIds(await entryRows(POSTS))).toEqual(sortedIds([entry.id, id]));
});

it("ENT-DUP-4 슬러그 형식이 맞지 않으면 글을 복제할 수 없다", async () => {
	const entry = await seedEntry();

	// ENT-DUP-4.1
	await expect(montiOf().entries.duplicate({ id: entry.id, slug: "hello world" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-DUP-4.2
	expect(rowIds(await entryRows(POSTS))).toEqual([entry.id]);
});

it("ENT-DUP-5 이미 쓰이고 있는 슬러그로는 글을 복제할 수 없다", async () => {
	const entry = await seedEntry({ slug: "hello" });

	// ENT-DUP-5.1
	await expect(montiOf().entries.duplicate({ id: entry.id, slug: "hello" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-DUP-5.2
	expect(rowIds(await entryRows(POSTS))).toEqual([entry.id]);
});

it("ENT-DUP-6 휴지통에 있는 글은 복제할 수 없다", async () => {
	const entry = await seedEntry({ trashed: true });

	// ENT-DUP-6.1
	await expect(montiOf().entries.duplicate({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// ENT-DUP-6.2
	expect(rowIds(await entryRows(POSTS))).toEqual([entry.id]);
});

it("ENT-DUP-7 원문 작업본의 필드나 본문이 휴지통에 있는 대상을 참조하고 있으면 복제할 수 없다", async () => {
	const cover = await seedMedia();
	const topic = await seedEntry({ collection: TOPICS });
	const image = await seedMedia();
	const withMedia = await seedEntry({ columns: { cover } });
	const withRelation = await seedEntry({ columns: { topic: topic.id } });
	const withBody = await seedEntry({ columns: { body: JSON.stringify(imageDoc(image)) } });
	await trashMedia(cover);
	await trashEntry(TOPICS, topic.id);
	await trashMedia(image);

	const codes = [
		await codeOf(montiOf().entries.duplicate({ id: withMedia.id })),
		await codeOf(montiOf().entries.duplicate({ id: withRelation.id })),
		await codeOf(montiOf().entries.duplicate({ id: withBody.id })),
	];

	// ENT-DUP-7.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
	// ENT-DUP-7.2
	expect(rowIds(await entryRows(POSTS))).toEqual(sortedIds([withMedia.id, withRelation.id, withBody.id]));
});

// ---- 7. 참조 교체 ----

/** 같은 `topics` 컬렉션의 옛 글과 새 글. */
async function seedTopicPair(trashed: { old?: boolean; into?: boolean } = {}) {
	const old = await seedEntry({ collection: TOPICS, trashed: trashed.old });
	const into = await seedEntry({ collection: TOPICS, trashed: trashed.into });
	return { old, into };
}

it("ENT-DUP-8 같은 글을 슬러그 없이 동시에 두 번 복제하면 서로 다른 번호의 슬러그를 배정받는다", async () => {
	const source = await seedEntry({ slug: "hello" });

	// 첫 복제가 비어 있는 번호 슬러그를 확인한 직후 멈춘 동안 두 번째 복제가 시작된다.
	const [first, second] = await overlap(
		db,
		(hold) => heldMonti(/"d"\."slug" like \$/, hold).entries.duplicate({ id: source.id }),
		() => montiOf().entries.duplicate({ id: source.id }),
	);
	const slugs = [];
	for (const copy of [first.value, second.value]) {
		if (copy !== undefined) slugs.push((await dataRow(POSTS, copy.id, "ko", "draft"))?.slug);
	}

	// ENT-DUP-8.1
	expect([first.code, second.code]).toEqual([null, null]);
	// ENT-DUP-8.2
	expect(slugs.sort()).toEqual(["hello-copy", "hello-copy-2"]);
});

it("ENT-REF-1 다른 글들이 가리키던 대상을 작업본과 발행본 모두 새 대상으로 바꾸고 옛 글은 그대로 둔다", async () => {
	const { old, into } = await seedTopicPair();
	const post = await seedEntry({ columns: { title: "Draft", topic: old.id } });
	const published = await seedCopy(POSTS, post.id, "ko", "published", {
		slug: "live",
		columns: { title: "Live", topic: old.id },
	});

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id });

	// ENT-REF-1.1
	expect(output).toEqual({ from_id: old.id, into_id: into.id, updated_ids: [post.id] });
	// ENT-REF-1.2
	expect({
		draft: (await dataRow(POSTS, post.id, "ko", "draft"))?.topic,
		published: (await dataRow(POSTS, post.id, "ko", "published"))?.topic,
	}).toEqual({ draft: into.id, published: into.id });
	// ENT-REF-1.3
	expect(await dataRow(POSTS, post.id, "ko", "published")).toMatchObject({
		title: "Live",
		slug: published.slug,
		published_at: PUBLISHED_AT,
	});
	// ENT-REF-1.4
	expect((await entryRow(TOPICS, old.id)).trashed_at).toBeNull();
});

it("ENT-REF-2 여러 개를 고르는 관계 필드에 바꿀 대상이 이미 들어 있으면 먼저 등장한 위치 하나만 남긴다", async () => {
	const { old, into } = await seedTopicPair();
	const other = await seedEntry({ collection: TOPICS });
	const page = await seedEntry({
		collection: PAGES,
		rels: [{ path: "topic", column: "topics_id", ids: [old.id, other.id, into.id] }],
	});

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id });

	// ENT-REF-2.1
	expect(output.updated_ids).toEqual([page.id]);
	// ENT-REF-2.2
	expect((await relsRows(PAGES, page.id, "topics_id")).map(({ position, id }) => ({ position, id }))).toEqual([
		{ position: 0, id: into.id },
		{ position: 1, id: other.id },
	]);
});

it("ENT-REF-3 조건부 필드 안에 들어 있는 관계 참조도 함께 바꾼다", async () => {
	const { old, into } = await seedTopicPair();
	const note = await seedEntry({ collection: NOTES, columns: { kind: "link", kind__link__topic: old.id } });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id });

	// ENT-REF-3.1
	expect(output.updated_ids).toEqual([note.id]);
	// ENT-REF-3.2
	expect((await dataRow(NOTES, note.id, "ko", "draft"))?.kind__link__topic).toBe(into.id);
});

it("ENT-REF-4 휴지통에 있는 다른 글이 가리키던 참조도 함께 바꾼다", async () => {
	const { old, into } = await seedTopicPair();
	const trashed = await seedEntry({ columns: { topic: old.id }, trashed: true });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id });

	// ENT-REF-4.1
	expect(output.updated_ids).toEqual([trashed.id]);
	// ENT-REF-4.2
	expect((await dataRow(POSTS, trashed.id, "ko", "draft"))?.topic).toBe(into.id);
});

it("ENT-REF-5 옛 글이 이미 휴지통에 있어도 다른 글의 참조를 새 글로 바꿀 수 있다", async () => {
	const { old, into } = await seedTopicPair({ old: true });
	const post = await seedEntry({ columns: { topic: old.id } });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id });

	// ENT-REF-5.1
	expect(output.updated_ids).toEqual([post.id]);
	// ENT-REF-5.2
	expect((await dataRow(POSTS, post.id, "ko", "draft"))?.topic).toBe(into.id);
});

it("ENT-REF-6 글의 참조를 자기 자신으로 바꿀 수는 없다", async () => {
	const topic = await seedEntry({ collection: TOPICS });

	// ENT-REF-6.1
	await expect(montiOf().entries.replaceReferences({ from_id: topic.id, into_id: topic.id })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("ENT-REF-7 서로 다른 컬렉션의 글끼리는 참조를 바꿀 수 없다", async () => {
	const old = await seedEntry({ collection: TOPICS });
	const into = await seedEntry({ collection: PAGES });

	// ENT-REF-7.1
	await expect(montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

it("ENT-REF-8 바꿀 새 글이 휴지통에 있으면 아무 참조도 바꾸지 않고 거절한다", async () => {
	const { old, into } = await seedTopicPair({ into: true });
	const post = await seedEntry({ columns: { topic: old.id } });

	// ENT-REF-8.1
	await expect(montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-REF-8.2
	expect((await dataRow(POSTS, post.id, "ko", "draft"))?.topic).toBe(old.id);
});

it("ENT-REF-9 여러 언어가 있는 글의 참조를 바꾸면 모든 언어의 작업본과 발행본을 고치고 글 ID는 한 번만 돌려준다", async () => {
	const { old, into } = await seedTopicPair();
	const post = await seedEntry({ columns: { topic: old.id } });
	await seedCopy(POSTS, post.id, "ko", "published", { columns: { topic: old.id } });
	await seedCopy(POSTS, post.id, "en", "draft", { columns: { topic: old.id } });
	await seedCopy(POSTS, post.id, "en", "published", { columns: { topic: old.id } });

	const output = await montiOf().entries.replaceReferences({ from_id: old.id, into_id: into.id });
	const topics = async (status: string) =>
		(await dataRows(POSTS, post.id)).filter((row) => row.status === status).map((row) => row.topic);

	// ENT-REF-9.1
	expect(output.updated_ids).toEqual([post.id]);
	// ENT-REF-9.2
	expect(await topics("draft")).toEqual([into.id, into.id]);
	// ENT-REF-9.3
	expect(await topics("published")).toEqual([into.id, into.id]);
});

it("ENT-REF-10 존재하지 않는 글 ID로는 참조를 바꿀 수 없다", async () => {
	const topic = await seedEntry({ collection: TOPICS });
	const monti = montiOf();

	const codes = [
		await codeOf(monti.entries.replaceReferences({ from_id: randomUUID(), into_id: topic.id })),
		await codeOf(monti.entries.replaceReferences({ from_id: topic.id, into_id: randomUUID() })),
	];

	// ENT-REF-10.1
	expect(codes).toEqual(["NOT_FOUND", "NOT_FOUND"]);
});

// ---- 8. 언어 추가 ----

it("ENT-REF-11 다건 관계 필드를 편집하는 동안 참조 교체가 동시에 실행되어도 새로 추가한 관계가 사라지지 않는다", async () => {
	const [oldAuthor, newAuthor, extra] = [
		await seedEntry({ collection: TOPICS }),
		await seedEntry({ collection: TOPICS }),
		await seedEntry({ collection: TOPICS }),
	];
	const page = await seedEntry({
		collection: PAGES,
		rels: [{ path: "topic", column: "topics_id", ids: [oldAuthor.id] }],
	});

	// 참조 교체가 `[옛 작성자]`를 읽은 직후 멈춘 동안 다건 관계 수정이 커밋된다.
	const [replace, update] = await overlap(
		db,
		(hold) =>
			heldMonti(/"topics_id" from "pages_rels"/, hold).entries.replaceReferences({
				from_id: oldAuthor.id,
				into_id: newAuthor.id,
			}),
		() => montiOf().entries.update({ id: page.id, fields: { topic: [oldAuthor.id, extra.id] } }),
		{ commits: true },
	);

	// ENT-REF-11.1
	expect([replace.code, update.code]).toEqual([null, null]);
	// ENT-REF-11.2
	expect((await relsRows(PAGES, page.id, "topics_id")).map((rel) => rel.id)).toEqual([newAuthor.id, extra.id]);
});

it("ENT-LOC-1 활성 글에 비원문 언어를 추가할 때 슬러그를 생략하면 원문 언어의 슬러그를 기본으로 복사한다", async () => {
	const folder = await seedFolder({ scope: NOTES });
	const entry = await seedEntry({ collection: NOTES, slug: "open-notice", folder_id: folder, columns: FILLED_NOTE });

	const output = await montiOf().entries.addLocale({ id: entry.id, locale: "en" });

	// ENT-LOC-1.1
	expect(output).toEqual({
		id: entry.id,
		collection: NOTES,
		locale: "en",
		source_locale: "ko",
		folder_id: folder,
		slug: "open-notice",
		fields: {},
		published_at: null,
	});
	// ENT-LOC-1.2
	expect(await dataRow(NOTES, entry.id, "en", "draft")).toMatchObject({ slug: "open-notice", translation_seen: {} });
	// ENT-LOC-1.3
	expect(await dataRow(NOTES, entry.id, "en", "published")).toBeUndefined();
});

it("ENT-LOC-2 필드나 본문을 담아 언어를 추가하면 글 전체 언어 기준으로 미디어 사용처를 갱신한다", async () => {
	const first = await seedMedia();
	const second = await seedMedia();
	const { entry } = await seedEntryUsing(first);
	const fields = { cover: second };

	const output = await montiOf().entries.addLocale({ id: entry.id, locale: "en", fields });

	// ENT-LOC-2.1
	expect(output.fields).toEqual(fields);
	// ENT-LOC-2.2
	expect(await useRows("entry", entry.id)).toEqual(
		[coverUse(entry.id, first), coverUse(entry.id, second)].sort((a, b) => a.media_id.localeCompare(b.media_id)),
	);
});

it("ENT-LOC-3 스키마에 없는 언어 코드는 추가할 수 없다", async () => {
	const entry = await seedEntry();

	// ENT-LOC-3.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "ja" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-LOC-3.2
	expect(await dataRow(POSTS, entry.id, "ja", "draft")).toBeUndefined();
});

it("ENT-LOC-4 이미 있는 언어는 다시 추가할 수 없다", async () => {
	const entry = await seedEntry();
	await seedCopy(POSTS, entry.id, "en", "draft", { columns: { title: "En" } });
	const before = await dataRow(POSTS, entry.id, "en", "draft");

	// ENT-LOC-4.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-LOC-4.2
	expect(await dataRow(POSTS, entry.id, "en", "draft")).toEqual(before);
});

it("ENT-LOC-5 같은 컬렉션·언어의 다른 활성 글과 슬러그가 겹치면 언어를 추가할 수 없다", async () => {
	const first = await seedEntry();
	await seedCopy(POSTS, first.id, "en", "draft", { slug: "hello" });
	const second = await seedEntry();

	// ENT-LOC-5.1
	await expect(montiOf().entries.addLocale({ id: second.id, locale: "en", slug: "hello" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	// ENT-LOC-5.2
	expect(await dataRow(POSTS, second.id, "en", "draft")).toBeUndefined();
});

it("ENT-LOC-6 슬러그 형식이 맞지 않으면 언어를 추가할 수 없다", async () => {
	const entry = await seedEntry();

	// ENT-LOC-6.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: "hello world" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-LOC-6.2
	expect(await dataRow(POSTS, entry.id, "en", "draft")).toBeUndefined();
});

it("ENT-LOC-7 필드의 타입이나 제약에 어긋난 값으로는 언어를 추가할 수 없다", async () => {
	const entry = await seedEntry();

	// ENT-LOC-7.1
	await expect(
		montiOf().entries.addLocale({ id: entry.id, locale: "en", fields: { views: "3" } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-LOC-7.2
	expect(await dataRow(POSTS, entry.id, "en", "draft")).toBeUndefined();
});

it("ENT-LOC-8 휴지통에 있는 글에는 언어를 추가할 수 없다", async () => {
	const entry = await seedEntry({ trashed: true });

	// ENT-LOC-8.1
	await expect(montiOf().entries.addLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-LOC-8.2
	expect(await dataRow(POSTS, entry.id, "en", "draft")).toBeUndefined();
});

it("ENT-LOC-9 휴지통에 있는 대상을 참조해 언어를 추가할 수 없다", async () => {
	const entry = await seedEntry();
	const trashed = await seedMedia(true);

	// ENT-LOC-9.1
	await expect(
		montiOf().entries.addLocale({ id: entry.id, locale: "en", fields: { cover: trashed } }),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// ENT-LOC-9.2
	expect(await dataRow(POSTS, entry.id, "en", "draft")).toBeUndefined();
});

// ---- 9. 언어 삭제 ----

it("ENT-LOC-10 한 글에 같은 번역 언어를 동시에 두 번 추가하면 한 건만 성공하고 나머지는 거절된다", async () => {
	const entry = await seedEntry();
	const inputs = [
		{ id: entry.id, locale: "en", fields: { title: "First" } },
		{ id: entry.id, locale: "en", fields: { title: "Second" } },
	];

	// 첫 추가가 `"en"` 작업본이 없음을 확인한 직후 멈춘 동안 두 번째 추가가 시작된다.
	const [first, second] = await overlap(
		db,
		(hold) => heldMonti(/^select "locale" from "posts_data"/, hold).entries.addLocale(inputs[0]),
		() => montiOf().entries.addLocale(inputs[1]),
	);
	const winner = first.code === null ? inputs[0] : inputs[1];

	// ENT-LOC-10.1
	expect([first.code, second.code].sort()).toEqual(["CONFLICT", null]);
	// ENT-LOC-10.2
	expect((await dataRow(POSTS, entry.id, "en", "draft"))?.title).toBe(winner.fields.title);
});

it("ENT-LOC-11 서로 다른 두 글에 같은 번역 언어와 같은 슬러그를 동시에 추가하면 한 건만 성공하고 나머지는 거절된다", async () => {
	const [one, two] = [await seedEntry(), await seedEntry()];

	// 첫 추가가 `"en"` 슬러그가 비어 있음을 확인한 직후 멈춘 동안 두 번째 추가가 시작된다.
	const [first, second] = await overlap(
		db,
		(hold) => heldMonti(SLUG_CHECK, hold).entries.addLocale({ id: one.id, locale: "en", slug: "same" }),
		() => montiOf().entries.addLocale({ id: two.id, locale: "en", slug: "same" }),
	);
	const same = (await dataRows(POSTS)).filter((row) => row.status === "draft" && row.slug === "same");

	// ENT-LOC-11.1
	expect([first.code, second.code].sort()).toEqual(["CONFLICT", null]);
	// ENT-LOC-11.2
	expect(same.filter((row) => row.locale === "en")).toHaveLength(1);
});

it("ENT-RLOC-1 비원문 언어를 즉시 삭제하면 발행본도 함께 지워지고 남은 언어 기준으로 미디어 사용처를 갱신한다", async () => {
	const [first, second, third] = [await seedMedia(), await seedMedia(), await seedMedia()];
	const ko = {
		rels: [{ path: "gallery", column: "media_id", ids: [first] }],
		columns: { body: JSON.stringify(imageDoc(third)) },
	};
	const en = [{ path: "gallery", column: "media_id", ids: [first, second] }];
	const entry = await seedEntry(ko);
	await seedCopy(POSTS, entry.id, "ko", "published", ko);
	await seedCopy(POSTS, entry.id, "en", "draft", { rels: en });
	await seedCopy(POSTS, entry.id, "en", "published", { rels: en });
	for (const media_id of [first, second])
		await seedUse({ media_id, source_kind: "entry", source_id: entry.id, field_path: "gallery" });
	// 세 번째 미디어를 휴지통에서 영구 삭제했다: `media` 행이 없고 본문의 참조만 남았다.
	await db.deleteFrom("media").where("id", "=", third).execute();
	const kept = {
		entry: await entryRow(POSTS, entry.id),
		ko: (await dataRows(POSTS, entry.id)).filter((row) => row.locale === "ko"),
	};

	const output = await montiOf().entries.removeLocale({ id: entry.id, locale: "en" });

	// ENT-RLOC-1.1
	expect(output).toEqual({ id: entry.id, locale: "en" });
	// ENT-RLOC-1.2
	expect((await dataRows(POSTS, entry.id)).filter((row) => row.locale === "en")).toEqual([]);
	// ENT-RLOC-1.3
	expect({ entry: await entryRow(POSTS, entry.id), ko: await dataRows(POSTS, entry.id) }).toEqual(kept);
	// ENT-RLOC-1.4
	expect((await useRows("entry", entry.id)).map((use) => use.media_id)).toEqual([first]);
});

it("ENT-RLOC-2 아직 발행하지 않은 비원문 언어도 즉시 삭제할 수 있다", async () => {
	const entry = await seedEntry();
	await seedCopy(POSTS, entry.id, "en", "draft");
	const kept = { entry: await entryRow(POSTS, entry.id), ko: await dataRow(POSTS, entry.id, "ko", "draft") };

	const output = await montiOf().entries.removeLocale({ id: entry.id, locale: "en" });

	// ENT-RLOC-2.1
	expect(output).toEqual({ id: entry.id, locale: "en" });
	// ENT-RLOC-2.2
	expect({
		en: await dataRow(POSTS, entry.id, "en", "draft"),
		ko: await dataRow(POSTS, entry.id, "ko", "draft"),
		entry: await entryRow(POSTS, entry.id),
	}).toEqual({ en: undefined, ...kept });
});

it("ENT-RLOC-3 원문 언어는 바로 삭제할 수 없다", async () => {
	const entry = await seedEntry();
	await seedCopy(POSTS, entry.id, "en", "draft");
	const before = { entry: await entryRow(POSTS, entry.id), data: await dataRows(POSTS, entry.id) };

	// ENT-RLOC-3.1
	await expect(montiOf().entries.removeLocale({ id: entry.id, locale: "ko" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	// ENT-RLOC-3.2
	expect({ entry: await entryRow(POSTS, entry.id), data: await dataRows(POSTS, entry.id) }).toEqual(before);
});

it("ENT-RLOC-4 글에 없는 언어는 삭제할 수 없다", async () => {
	const entry = await seedEntry();
	const before = await dataRow(POSTS, entry.id, "ko", "draft");

	// ENT-RLOC-4.1
	await expect(montiOf().entries.removeLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-RLOC-4.2
	expect(await dataRow(POSTS, entry.id, "ko", "draft")).toEqual(before);
});

it("ENT-RLOC-5 휴지통에 있는 글의 언어는 삭제할 수 없다", async () => {
	const entry = await seedEntry({ trashed: true });
	await seedCopy(POSTS, entry.id, "en", "draft");
	const before = await dataRow(POSTS, entry.id, "en", "draft");

	// ENT-RLOC-5.1
	await expect(montiOf().entries.removeLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-RLOC-5.2
	expect(await dataRow(POSTS, entry.id, "en", "draft")).toEqual(before);
});

// ---- 10. 원문 언어 변경 ----

/** `ko` 원문 작업본과 발행할 수 있는 `en` 번역 언어 작업본을 가진 `posts` 활성 글. */
async function seedTranslatedEntry() {
	const entry = await seedEntry({ columns: { title: "한국어 제목" } });
	await seedCopy(POSTS, entry.id, "en", "draft", { columns: { title: "English title" } });
	return entry;
}

it("ENT-RLOC-6 번역 언어 삭제가 원문 언어 변경보다 먼저 반영되면 원문 변경이 거절되고 기존 원문 작업본이 유지된다", async () => {
	const entry = await seedTranslatedEntry();

	// 원문 언어 변경이 `"en"` 작업본을 확인한 직후 멈춘 동안 `"en"` 삭제가 커밋된다.
	const [source, removal] = await overlap(
		db,
		(hold) => heldMonti(DRAFT_READ, hold).entries.setSourceLocale({ id: entry.id, locale: "en" }),
		() => montiOf().entries.removeLocale({ id: entry.id, locale: "en" }),
		{ commits: true },
	);

	// ENT-RLOC-6.1
	expect([source.code, removal.code]).toEqual(["NOT_FOUND", null]);
	// ENT-RLOC-6.2
	expect({
		source_locale: (await entryRow(POSTS, entry.id)).source_locale,
		ko: (await dataRow(POSTS, entry.id, "ko", "draft")) !== undefined,
	}).toEqual({ source_locale: "ko", ko: true });
});

it("ENT-RLOC-7 번역 언어를 삭제하는 동안 그 언어의 수정이 겹쳐도 지운 언어가 되살아나지 않는다", async () => {
	const entry = await seedTranslatedEntry();

	// `"en"` 수정이 작업본을 읽은 직후 멈춘 동안 `"en"` 삭제가 커밋된다.
	const [update, removal] = await overlap(
		db,
		(hold) =>
			heldMonti(DRAFT_READ, hold).entries.update({ id: entry.id, locale: "en", fields: { title: "New title" } }),
		() => montiOf().entries.removeLocale({ id: entry.id, locale: "en" }),
		{ commits: true },
	);

	// ENT-RLOC-7.1
	expect([update.code, removal.code]).toEqual(["NOT_FOUND", null]);
	// ENT-RLOC-7.2
	expect(await dataRow(POSTS, entry.id, "en", "draft")).toBeUndefined();
});

it("ENT-RLOC-8 번역 언어를 삭제하는 동안 그 언어의 발행이 겹쳐도 발행본만 남지 않는다", async () => {
	const entry = await seedTranslatedEntry();

	// `"en"` 발행이 작업본을 읽은 직후 멈춘 동안 `"en"` 삭제가 커밋된다.
	const [publish, removal] = await overlap(
		db,
		(hold) => heldMonti(DRAFT_READ, hold).entries.publish({ id: entry.id, locale: "en" }),
		() => montiOf().entries.removeLocale({ id: entry.id, locale: "en" }),
		{ commits: true },
	);

	// ENT-RLOC-8.1
	expect([publish.code, removal.code]).toEqual(["NOT_FOUND", null]);
	// ENT-RLOC-8.2
	expect((await dataRows(POSTS, entry.id)).filter((row) => row.locale === "en")).toEqual([]);
});

it("ENT-SRC-1 기준 언어를 다른 언어로 바꾸면 원문 언어가 바뀌고 그 글의 모든 언어 번역 추적 기록이 초기화된다", async () => {
	const seen = { "fields.title": "Draft" };
	const { entry } = await seedPublishedEntry();
	await tables
		.updateTable(`${POSTS}_data`)
		.set({ translation_seen: JSON.stringify(seen) })
		.where("entry_id", "=", entry.id)
		.where("status", "=", "published")
		.execute();
	const en = await seedCopy(POSTS, entry.id, "en", "draft", { columns: { title: "En" }, translation_seen: seen });
	const enPublished = await seedCopy(POSTS, entry.id, "en", "published", {
		published_at: new Date("2026-11-07T00:00:00.000Z"),
		translation_seen: seen,
	});
	await seedCopy(POSTS, entry.id, "ja", "draft", { translation_seen: seen });
	const other = await seedEntry({ translation_seen: seen });
	const published = (await dataRows(POSTS, entry.id)).filter((row) => row.status === "published");

	const output = await montiOf().entries.setSourceLocale({ id: entry.id, locale: "en" });

	// ENT-SRC-1.1
	expect(output).toEqual({
		id: entry.id,
		collection: POSTS,
		folder_id: null,
		slug: en.slug,
		fields: { title: "En" },
		published_at: enPublished.published_at,
		locale: "en",
		source_locale: "en",
	});
	// ENT-SRC-1.2
	expect((await entryRow(POSTS, entry.id)).source_locale).toBe("en");
	// ENT-SRC-1.3
	expect(
		(await dataRows(POSTS, entry.id)).filter((row) => row.status === "draft").map((row) => row.translation_seen),
	).toEqual([{}, {}, {}]);
	// ENT-SRC-1.4
	expect({
		published: (await dataRows(POSTS, entry.id)).filter((row) => row.status === "published"),
		other: (await dataRow(POSTS, other.id, "ko", "draft"))?.translation_seen,
	}).toEqual({ published, other: seen });
});

it("ENT-SRC-2 이미 원문 언어인 언어를 다시 지정하면 번역 추적 기록을 유지한 채 그대로 돌려준다", async () => {
	const seen = { "fields.title": "Ko" };
	const entry = await seedEntry({ columns: { title: "Ko" } });
	await seedCopy(POSTS, entry.id, "en", "draft", { translation_seen: seen });

	const output = await montiOf().entries.setSourceLocale({ id: entry.id, locale: "ko" });

	// ENT-SRC-2.1
	expect(output).toEqual({
		id: entry.id,
		collection: POSTS,
		folder_id: null,
		slug: entry.slug,
		fields: { title: "Ko" },
		published_at: null,
		locale: "ko",
		source_locale: "ko",
	});
	// ENT-SRC-2.2
	expect((await dataRow(POSTS, entry.id, "en", "draft"))?.translation_seen).toEqual(seen);
});

it("ENT-SRC-3 글에 없는 언어는 원문 언어로 지정할 수 없다", async () => {
	const entry = await seedEntry();

	// ENT-SRC-3.1
	await expect(montiOf().entries.setSourceLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-SRC-3.2
	expect((await entryRow(POSTS, entry.id)).source_locale).toBe("ko");
});

it("ENT-SRC-4 휴지통에 있는 글은 원문 언어를 바꿀 수 없다", async () => {
	const seen = { "fields.title": "Ko" };
	const entry = await seedEntry({ trashed: true });
	await seedCopy(POSTS, entry.id, "en", "draft", { translation_seen: seen });

	// ENT-SRC-4.1
	await expect(montiOf().entries.setSourceLocale({ id: entry.id, locale: "en" })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// ENT-SRC-4.2
	expect({
		source_locale: (await entryRow(POSTS, entry.id)).source_locale,
		translation_seen: (await dataRow(POSTS, entry.id, "en", "draft"))?.translation_seen,
	}).toEqual({ source_locale: "ko", translation_seen: seen });
});

it("ENT-SRC-5 원문 언어 변경이 번역 언어 삭제보다 먼저 반영되면 삭제가 거절되고 새 원문 작업본이 유지된다", async () => {
	const entry = await seedTranslatedEntry();

	// `"en"` 삭제가 `"en"`이 원문 언어가 아님을 확인한 직후 멈춘 동안 원문 언어 변경이 커밋된다.
	const [removal, source] = await overlap(
		db,
		(hold) => heldMonti(DRAFT_READ, hold).entries.removeLocale({ id: entry.id, locale: "en" }),
		() => montiOf().entries.setSourceLocale({ id: entry.id, locale: "en" }),
		{ commits: true },
	);

	// ENT-SRC-5.1
	expect([removal.code, source.code]).toEqual(["BAD_REQUEST", null]);
	// ENT-SRC-5.2
	expect({
		source_locale: (await entryRow(POSTS, entry.id)).source_locale,
		en: (await dataRow(POSTS, entry.id, "en", "draft")) !== undefined,
	}).toEqual({ source_locale: "en", en: true });
});
