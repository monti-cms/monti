import { randomUUID } from "node:crypto";
import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { createMemoryStorage, type MemoryStorage } from "../../__test__/memory-storage";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { Schema } from "../../engine/types";
import { entries } from "../entries/entries";
import { folders } from "../folders/folders";
import { media } from "../media/media";
import { syncSchemaTables } from "../schema/sync-tables";
import { trash } from "./trash";

type Row = Record<string, unknown>;

let testDb: TestDatabase;
let db: Kysely<Database>;
/** 컬렉션별 테이블을 이름으로 읽고 쓰는 연결. */
let tables: Kysely<Record<string, Row>>;
let storage: MemoryStorage;

const POSTS = "posts";
const TAGS = "tags";

/** `posts`는 본문과 `tags`로 가는 단건·다건 관계, 단건·다건 미디어를 가진다. `tags`는 제목과 단건 미디어를 가진다. */
const SCHEMA: Schema = {
	locales: ["ko", "en"],
	collections: {
		[POSTS]: {
			body: true,
			fields: {
				title: { type: "text" },
				tag: { type: "relation", to: TAGS },
				tags: { type: "relation", to: TAGS, many: true },
				cover: { type: "media" },
				gallery: { type: "media", many: true },
			},
		},
		[TAGS]: { fields: { title: { type: "text" }, icon: { type: "media" } } },
	},
};

function montiOf(withStorage = true) {
	return createMonti(db, { entries, folders, media, trash }, [], {
		schema: SCHEMA,
		config: { name: "Monti Blog", dev: false, storage: withStorage ? storage : undefined },
		schemaFile: "unused-schema-file",
		configFile: "unused-config-file",
	});
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	await syncSchemaTables(testDb.db, SCHEMA);
	db = testDb.db as Kysely<Database>;
	tables = testDb.db.withTables<Record<string, Row>>();
	storage = createMemoryStorage();
});

afterEach(async () => {
	await testDb.drop();
});

interface EntrySeed {
	collection?: string;
	slug?: string;
	folder_id?: string;
	fields?: Record<string, unknown>;
	mediaId?: string;
}

/** `entries.create`로 `ko` 원문 작업본을 가진 활성 글을 만든다. `mediaId`가 있으면 본문에 그 이미지를 넣는다. */
async function createEntry(seed: EntrySeed = {}) {
	const body =
		seed.mediaId === undefined
			? {}
			: { body: { blocks: [{ id: "i1", type: "image", attrs: { mediaId: seed.mediaId } }] } };
	return montiOf().entries.create({
		collection: seed.collection ?? POSTS,
		locale: "ko",
		slug: seed.slug ?? `entry-${randomUUID()}`,
		folder_id: seed.folder_id,
		fields: seed.fields ?? { title: "제목" },
		...body,
	});
}

/** `ko`와 `en` 작업본을 가지고 두 언어 모두 발행된 글. */
async function createPublishedEntry(seed: EntrySeed = {}) {
	const entry = await createEntry(seed);
	await montiOf().entries.addLocale({ id: entry.id, locale: "en", slug: `entry-${randomUUID()}` });
	await montiOf().entries.publish({ id: entry.id });
	await montiOf().entries.publish({ id: entry.id, locale: "en" });
	return entry;
}

async function createFolder(scope: string, parent_id: string | null = null, name = "Folder") {
	return montiOf().folders.create({ scope, parent_id, name });
}

/** 메모리 저장소에 파일을 올리고 `media.create`로 등록한다. */
async function createMedia(folder_id: string | null = null, filename?: string) {
	const key = randomUUID();
	storage.seed(key, { mime: "image/png", size: 1024 });
	return montiOf().media.create({ key, folder_id, filename });
}

async function moveToTrash(id: string) {
	await montiOf().trash.move({ id });
}

/** 항목을 휴지통에 보내고 `trashed_at`을 `hours`시간 앞당긴다: 그만큼 먼저 버린 것처럼. */
async function trashEarlier(table: string, id: string, hours = 1) {
	await moveToTrash(id);
	await sql`update ${sql.table(table)} set trashed_at = trashed_at - make_interval(hours => ${hours}) where id = ${id}`.execute(
		db,
	);
}

/** Postgres가 출력하는 항목의 `trashed_at`: 마이크로초까지. */
async function trashedAtText(table: string, id: string): Promise<string | null> {
	const { rows } = await sql<{ at: string | null }>`
		select trashed_at::text as at from ${sql.table(table)} where id = ${id}
	`.execute(db);
	return rows[0].at;
}

/** `<collection>` 테이블의 글 행. */
async function entryRow(id: string, collection = POSTS) {
	return tables.selectFrom(collection).selectAll().where("id", "=", id).executeTakeFirst();
}

/** `<collection>_data` 테이블의 글 행들: 언어, 상태 순. `status`를 주면 그 상태만. */
async function copyRows(id: string, collection = POSTS, status?: string) {
	let query = tables.selectFrom(`${collection}_data`).selectAll().where("entry_id", "=", id);
	if (status !== undefined) query = query.where("status", "=", status);
	return query.orderBy("locale").orderBy("status").execute();
}

/** `<collection>_rels` 테이블의 글 행들: 언어, 상태, 경로, 순서 순. */
async function relRows(id: string, collection = POSTS) {
	return tables
		.selectFrom(`${collection}_rels`)
		.selectAll()
		.where("entry_id", "=", id)
		.orderBy("locale")
		.orderBy("status")
		.orderBy("path")
		.orderBy("position")
		.execute();
}

async function folderRow(id: string) {
	return db.selectFrom("folders").selectAll().where("id", "=", id).executeTakeFirst();
}

async function mediaRow(id: string) {
	return db.selectFrom("media").selectAll().where("id", "=", id).executeTakeFirst();
}

async function usesOfMedia(id: string) {
	return db.selectFrom("media_uses").selectAll().where("media_id", "=", id).execute();
}

async function usesOfEntry(id: string) {
	return db.selectFrom("media_uses").selectAll().where("source_id", "=", id).execute();
}

async function looseFile(key: string) {
	return db.selectFrom("loose_files").selectAll().where("key", "=", key).executeTakeFirst();
}

function byId(a: { id: string }, b: { id: string }): number {
	return a.id < b.id ? -1 : 1;
}

it("TRH-MOVE-1 글을 휴지통에 보내면 모든 언어 작업본과 발행본이 그 글과 함께 휴지통에 들어가고 내용은 그대로 유지된다", async () => {
	const entry = await createPublishedEntry();
	const before = await copyRows(entry.id);

	const output = await montiOf().trash.move({ id: entry.id });

	// TRH-MOVE-1.1
	expect((await entryRow(entry.id))?.trashed_at).toBeInstanceOf(Date);
	// TRH-MOVE-1.2
	expect(await copyRows(entry.id)).toEqual(before);
	// TRH-MOVE-1.3
	expect(output).toEqual({ kind: "entry", id: entry.id });
});

it("TRH-MOVE-2 글을 휴지통에 보내도 그 글을 가리키던 다른 글의 DB 참조 값은 복원을 위해 그대로 남는다", async () => {
	const tag = await createEntry({ collection: TAGS });
	const post = await createEntry({ fields: { title: "제목", tag: tag.id, tags: [tag.id] } });
	const before = { data: await copyRows(post.id), rels: await relRows(post.id) };

	await montiOf(false).trash.move({ id: tag.id });

	// TRH-MOVE-2.1
	expect({ data: await copyRows(post.id), rels: await relRows(post.id) }).toEqual(before);
});

it("TRH-MOVE-3 글이 쓰는 미디어를 휴지통에 보내도 DB 참조 값과 사용처 기록은 그대로 남는다", async () => {
	const item = await createMedia();
	const post = await createEntry({ fields: { title: "제목", cover: item.id, gallery: [item.id] }, mediaId: item.id });
	const before = {
		uses: await usesOfMedia(item.id),
		data: await copyRows(post.id),
		rels: await relRows(post.id),
	};

	await montiOf().trash.move({ id: item.id });

	// TRH-MOVE-3.1
	expect((await mediaRow(item.id))?.trashed_at).toBeInstanceOf(Date);
	// TRH-MOVE-3.2
	expect({
		uses: await usesOfMedia(item.id),
		data: await copyRows(post.id),
		rels: await relRows(post.id),
	}).toEqual(before);
});

it("TRH-MOVE-4 폴더를 휴지통에 보내면 그 아래 하위 폴더와 글이 같은 시각으로 함께 들어간다", async () => {
	const parent = await createFolder(POSTS);
	const child = await createFolder(POSTS, parent.id);
	const inParent = await createEntry({ folder_id: parent.id });
	const inChild = await createEntry({ folder_id: child.id });

	const output = await montiOf(false).trash.move({ id: parent.id });
	const times = [
		await trashedAtText("folders", parent.id),
		await trashedAtText("folders", child.id),
		await trashedAtText(POSTS, inParent.id),
		await trashedAtText(POSTS, inChild.id),
	];

	// TRH-MOVE-4.1
	expect({ distinct: new Set(times).size, unset: times.filter((at) => at === null).length }).toEqual({
		distinct: 1,
		unset: 0,
	});
	// TRH-MOVE-4.2
	expect(output).toEqual({ kind: "folder", id: parent.id });
});

it("TRH-MOVE-5 미디어 폴더를 휴지통에 보내면 그 아래 하위 폴더와 미디어가 같은 시각으로 함께 들어간다", async () => {
	const parent = await createFolder("media");
	const child = await createFolder("media", parent.id);
	const inParent = await createMedia(parent.id);
	const inChild = await createMedia(child.id);

	await montiOf().trash.move({ id: parent.id });
	const times = [
		await trashedAtText("folders", parent.id),
		await trashedAtText("folders", child.id),
		await trashedAtText("media", inParent.id),
		await trashedAtText("media", inChild.id),
	];

	// TRH-MOVE-5.1
	expect({ distinct: new Set(times).size, unset: times.filter((at) => at === null).length }).toEqual({
		distinct: 1,
		unset: 0,
	});
});

it("TRH-MOVE-6 이미 휴지통에 있는 항목은 다시 휴지통에 보낼 수 없다", async () => {
	const entry = await createEntry();
	await moveToTrash(entry.id);
	const before = await trashedAtText(POSTS, entry.id);

	// TRH-MOVE-6.1
	await expect(montiOf().trash.move({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
	// TRH-MOVE-6.2
	expect(await trashedAtText(POSTS, entry.id)).toBe(before);
});

it("TRH-READ-1 휴지통의 글·폴더·미디어만 최근에 버린 것부터 돌려준다", async () => {
	const entry = await createEntry();
	const folder = await createFolder(POSTS, null, "Trashed");
	const item = await createMedia(null, "photo.png");
	await createEntry();
	await trashEarlier(POSTS, entry.id, 3);
	await trashEarlier("folders", folder.id, 2);
	await trashEarlier("media", item.id, 1);

	const list = await montiOf().trash.list();

	// TRH-READ-1.1
	expect(list.map(({ id }) => id).sort()).toEqual([entry.id, folder.id, item.id].sort());
	// TRH-READ-1.2
	expect(list.map(({ id }) => id)).toEqual([item.id, folder.id, entry.id]);
	// TRH-READ-1.3
	expect([...list].sort(byId)).toEqual(
		[
			{ kind: "entry", id: entry.id, name: entry.slug, trashed_at: (await entryRow(entry.id))?.trashed_at },
			{ kind: "folder", id: folder.id, name: "Trashed", trashed_at: (await folderRow(folder.id))?.trashed_at },
			{ kind: "media", id: item.id, name: "photo.png", trashed_at: (await mediaRow(item.id))?.trashed_at },
		].sort(byId),
	);
});

it("TRH-READ-2 폴더와 함께 들어간 항목은 목록에 따로 나오지 않고 먼저 따로 버린 항목은 자기 줄로 나온다", async () => {
	const folder = await createFolder(POSTS);
	await createFolder(POSTS, folder.id);
	const earlier = await createEntry({ folder_id: folder.id });
	await createEntry({ folder_id: folder.id });
	await trashEarlier(POSTS, earlier.id);
	await moveToTrash(folder.id);

	const list = await montiOf().trash.list();

	// TRH-READ-2.1
	expect(list.map(({ kind, id }) => ({ kind, id }))).toEqual([
		{ kind: "folder", id: folder.id },
		{ kind: "entry", id: earlier.id },
	]);
});

it("TRH-READ-3 휴지통의 항목 하나를 조회한다", async () => {
	const entry = await createEntry();
	await moveToTrash(entry.id);

	const output = await montiOf().trash.get({ id: entry.id });

	// TRH-READ-3.1
	expect(output).toEqual({
		kind: "entry",
		id: entry.id,
		name: entry.slug,
		trashed_at: (await entryRow(entry.id))?.trashed_at,
	});
});

it("TRH-READ-4 휴지통에 있지 않은 항목은 휴지통에서 조회할 수 없다", async () => {
	const entry = await createEntry();

	// TRH-READ-4.1
	await expect(montiOf().trash.get({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("TRH-RST-1 글을 되살리면 발행본은 비워지고 초안 상태로 돌아온다", async () => {
	const entry = await createPublishedEntry();
	await moveToTrash(entry.id);
	const before = await copyRows(entry.id, POSTS, "draft");

	const output = await montiOf(false).trash.restore({ id: entry.id });

	// TRH-RST-1.1
	expect((await entryRow(entry.id))?.trashed_at).toBeNull();
	// TRH-RST-1.2
	expect(await copyRows(entry.id, POSTS, "published")).toEqual([]);
	// TRH-RST-1.3
	expect(await copyRows(entry.id, POSTS, "draft")).toEqual(before);
	// TRH-RST-1.4
	expect(output).toEqual({ kind: "entry", id: entry.id });
});

it("TRH-RST-2 폴더를 되살리면 함께 들어갔던 항목은 돌아오고 먼저 따로 버린 항목은 휴지통에 남는다", async () => {
	const folder = await createFolder(POSTS);
	const child = await createFolder(POSTS, folder.id);
	const published = await createPublishedEntry({ folder_id: folder.id });
	const earlier = await createEntry({ folder_id: folder.id });
	await trashEarlier(POSTS, earlier.id);
	const earlierAt = await trashedAtText(POSTS, earlier.id);
	await moveToTrash(folder.id);

	const output = await montiOf(false).trash.restore({ id: folder.id });

	// TRH-RST-2.1
	expect([
		(await folderRow(folder.id))?.trashed_at,
		(await folderRow(child.id))?.trashed_at,
		(await entryRow(published.id))?.trashed_at,
	]).toEqual([null, null, null]);
	// TRH-RST-2.2
	expect(await copyRows(published.id, POSTS, "published")).toEqual([]);
	// TRH-RST-2.3
	expect(await trashedAtText(POSTS, earlier.id)).toBe(earlierAt);
	// TRH-RST-2.4
	expect(output).toEqual({ kind: "folder", id: folder.id });
});

it("TRH-RST-3 글의 상위 폴더가 휴지통에 있을 때 그 글을 되살리면 같은 이름의 새 폴더를 만들어 그 안에 되살리고 휴지통의 폴더는 그대로 둔다", async () => {
	const parent = await createFolder(POSTS, null, "Parent");
	const child = await createFolder(POSTS, parent.id, "Child");
	const earlier = await createEntry({ folder_id: child.id });
	const other = await createEntry({ folder_id: parent.id });
	await trashEarlier(POSTS, earlier.id);
	await moveToTrash(parent.id);
	const before = {
		parent: await trashedAtText("folders", parent.id),
		child: await trashedAtText("folders", child.id),
		other: await trashedAtText(POSTS, other.id),
	};

	await montiOf(false).trash.restore({ id: earlier.id });
	const active = await db.selectFrom("folders").selectAll().where("trashed_at", "is", null).orderBy("name").execute();
	const [newChild, newParent] = active;

	// TRH-RST-3.1
	expect(active.map(({ id, scope, name }) => ({ scope, name, isNew: ![parent.id, child.id].includes(id) }))).toEqual([
		{ scope: POSTS, name: "Child", isNew: true },
		{ scope: POSTS, name: "Parent", isNew: true },
	]);
	// TRH-RST-3.2
	expect(newChild.parent_id).toBe(newParent.id);
	// TRH-RST-3.3
	expect(await entryRow(earlier.id)).toMatchObject({ trashed_at: null, folder_id: newChild.id });
	// TRH-RST-3.4
	expect({
		parent: await trashedAtText("folders", parent.id),
		child: await trashedAtText("folders", child.id),
		other: await trashedAtText(POSTS, other.id),
	}).toEqual(before);
});

it("TRH-RST-4 글의 상위 폴더가 휴지통에 있어도 같은 위치에 같은 이름의 활성 폴더가 있으면 새로 만들지 않고 그 폴더 안에 되살린다", async () => {
	const folder = await createFolder(POSTS, null, "Docs");
	const earlier = await createEntry({ folder_id: folder.id });
	await trashEarlier(POSTS, earlier.id);
	await moveToTrash(folder.id);
	const existing = await createFolder(POSTS, null, "Docs");

	await montiOf(false).trash.restore({ id: earlier.id });
	const twins = await db
		.selectFrom("folders")
		.select("id")
		.where("scope", "=", POSTS)
		.where("parent_id", "is", null)
		.where("name", "=", "Docs")
		.where("trashed_at", "is", null)
		.execute();

	// TRH-RST-4.1
	expect(twins).toEqual([{ id: existing.id }]);
	// TRH-RST-4.2
	expect(await entryRow(earlier.id)).toMatchObject({ trashed_at: null, folder_id: existing.id });
});

it("TRH-RST-5 폴더를 되살릴 때 같은 위치에 같은 이름의 활성 폴더가 있으면 번호를 붙여 되살린다", async () => {
	const folder = await createFolder(POSTS, null, "Docs");
	const inside = await createEntry({ folder_id: folder.id });
	await moveToTrash(folder.id);
	const active = await createFolder(POSTS, null, "Docs");

	await montiOf(false).trash.restore({ id: folder.id });

	// TRH-RST-5.1
	expect(await folderRow(folder.id)).toMatchObject({ name: "Docs-2", trashed_at: null });
	// TRH-RST-5.2
	expect(await entryRow(inside.id)).toMatchObject({ trashed_at: null, folder_id: folder.id });
	// TRH-RST-5.3
	expect((await folderRow(active.id))?.name).toBe("Docs");
});

it("TRH-RST-6 슬러그가 활성 글과 겹치는 글은 번호를 붙여 되살린다", async () => {
	const trashed = await createEntry({ slug: "hello" });
	await moveToTrash(trashed.id);
	const active = await createEntry({ slug: "hello" });

	await montiOf(false).trash.restore({ id: trashed.id });

	// TRH-RST-6.1
	expect({
		slug: (await copyRows(trashed.id, POSTS, "draft"))[0].slug,
		trashed_at: (await entryRow(trashed.id))?.trashed_at,
	}).toEqual({ slug: "hello-2", trashed_at: null });
	// TRH-RST-6.2
	expect((await copyRows(active.id, POSTS, "draft"))[0].slug).toBe("hello");
});

it("TRH-RST-7 미디어를 되살리면 휴지통에서 나온다", async () => {
	const item = await createMedia();
	await moveToTrash(item.id);

	const output = await montiOf().trash.restore({ id: item.id });

	// TRH-RST-7.1
	expect((await mediaRow(item.id))?.trashed_at).toBeNull();
	// TRH-RST-7.2
	expect(output).toEqual({ kind: "media", id: item.id });
});

it("TRH-RST-8 휴지통에 있지 않은 항목은 되살릴 수 없다", async () => {
	const entry = await createEntry();

	// TRH-RST-8.1
	await expect(montiOf().trash.restore({ id: entry.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("TRH-RST-9 미디어 폴더를 되살리면 함께 들어갔던 하위 폴더와 미디어가 함께 돌아온다", async () => {
	const parent = await createFolder("media");
	const child = await createFolder("media", parent.id);
	const inParent = await createMedia(parent.id);
	const inChild = await createMedia(child.id);
	await moveToTrash(parent.id);

	const output = await montiOf().trash.restore({ id: parent.id });

	// TRH-RST-9.1
	expect([
		(await folderRow(parent.id))?.trashed_at,
		(await folderRow(child.id))?.trashed_at,
		(await mediaRow(inParent.id))?.trashed_at,
		(await mediaRow(inChild.id))?.trashed_at,
	]).toEqual([null, null, null, null]);
	// TRH-RST-9.2
	expect(output).toEqual({ kind: "folder", id: parent.id });
});

it("TRH-DEL-1 글을 영구 삭제하면 그 글의 모든 데이터와 다른 글이 그 글을 가리키던 참조가 함께 정리된다", async () => {
	const item = await createMedia();
	const tag = await createPublishedEntry({ collection: TAGS, fields: { title: "태그", icon: item.id } });
	const post = await createEntry({ fields: { title: "제목", tag: tag.id, tags: [tag.id] } });
	await moveToTrash(tag.id);

	const output = await montiOf().trash.delete({ id: tag.id });

	// TRH-DEL-1.1
	expect({
		entry: await entryRow(tag.id, TAGS),
		data: await copyRows(tag.id, TAGS),
		rels: await relRows(tag.id, TAGS),
	}).toEqual({ entry: undefined, data: [], rels: [] });
	// TRH-DEL-1.2
	expect(await usesOfEntry(tag.id)).toEqual([]);
	// TRH-DEL-1.3
	expect({ tag: (await copyRows(post.id))[0].tag, rels: await relRows(post.id) }).toEqual({ tag: null, rels: [] });
	// TRH-DEL-1.4
	expect(output).toEqual({ kind: "entry", id: tag.id });
});

it("TRH-DEL-2 미디어를 영구 삭제하면 DB와 다른 글의 미디어 참조에서 완전히 정리되고 파일은 임시 파일 목록에 올라간다", async () => {
	const item = await createMedia();
	const post = await createEntry({ fields: { title: "제목", cover: item.id, gallery: [item.id] } });
	await moveToTrash(item.id);

	await montiOf().trash.delete({ id: item.id });
	const finishedAt = Date.now();
	const loose = await looseFile(item.key);

	// TRH-DEL-2.1
	expect({ media: await mediaRow(item.id), uses: await usesOfMedia(item.id) }).toEqual({ media: undefined, uses: [] });
	// TRH-DEL-2.2
	expect({ cover: (await copyRows(post.id))[0].cover, rels: await relRows(post.id) }).toEqual({
		cover: null,
		rels: [],
	});
	// TRH-DEL-2.3
	expect({
		key: loose?.key,
		notLater: (loose?.remove_after.getTime() ?? Number.POSITIVE_INFINITY) <= finishedAt,
	}).toEqual({ key: item.key, notLater: true });
	// TRH-DEL-2.4
	expect(storage.removed).toEqual([]);
});

it("TRH-DEL-3 컬렉션 폴더를 영구 삭제하면 함께 들어간 하위 폴더와 글이 지워지고 먼저 따로 버린 글은 휴지통에 남는다", async () => {
	const item = await createMedia();
	const folder = await createFolder(POSTS);
	const child = await createFolder(POSTS, folder.id);
	const inside = await createEntry({ folder_id: folder.id, mediaId: item.id });
	const earlier = await createEntry({ folder_id: folder.id });
	await trashEarlier(POSTS, earlier.id);
	const earlierAt = await trashedAtText(POSTS, earlier.id);
	await moveToTrash(folder.id);

	await montiOf().trash.delete({ id: folder.id });

	// TRH-DEL-3.1
	expect({ folder: await folderRow(folder.id), child: await folderRow(child.id) }).toEqual({
		folder: undefined,
		child: undefined,
	});
	// TRH-DEL-3.2
	expect({ entry: await entryRow(inside.id), uses: await usesOfEntry(inside.id) }).toEqual({
		entry: undefined,
		uses: [],
	});
	// TRH-DEL-3.3
	expect({
		trashed_at: await trashedAtText(POSTS, earlier.id),
		folder_id: (await entryRow(earlier.id))?.folder_id,
	}).toEqual({ trashed_at: earlierAt, folder_id: null });
});

it("TRH-DEL-4 미디어 폴더를 영구 삭제하면 하위 폴더와 안의 미디어가 지워지고 미디어의 파일은 임시 파일 목록에 올라간다", async () => {
	const folder = await createFolder("media");
	const child = await createFolder("media", folder.id);
	const item = await createMedia(folder.id);
	await createEntry({ mediaId: item.id });
	await moveToTrash(folder.id);

	await montiOf().trash.delete({ id: folder.id });
	const finishedAt = Date.now();
	const loose = await looseFile(item.key);

	// TRH-DEL-4.1
	expect({
		folder: await folderRow(folder.id),
		child: await folderRow(child.id),
		media: await mediaRow(item.id),
	}).toEqual({ folder: undefined, child: undefined, media: undefined });
	// TRH-DEL-4.2
	expect(await usesOfMedia(item.id)).toEqual([]);
	// TRH-DEL-4.3
	expect({
		key: loose?.key,
		notLater: (loose?.remove_after.getTime() ?? Number.POSITIVE_INFINITY) <= finishedAt,
	}).toEqual({ key: item.key, notLater: true });
});

it("TRH-DEL-5 여러 항목을 한 번에 영구 삭제한다", async () => {
	const entry = await createEntry();
	const folder = await createFolder(POSTS);
	await moveToTrash(entry.id);
	await moveToTrash(folder.id);

	const output = await montiOf(false).trash.delete({ ids: [entry.id, folder.id] });
	const items = Array.isArray(output) ? output : [output];

	// TRH-DEL-5.1
	expect({ entry: await entryRow(entry.id), folder: await folderRow(folder.id) }).toEqual({
		entry: undefined,
		folder: undefined,
	});
	// TRH-DEL-5.2
	expect([...items].sort(byId)).toEqual(
		[
			{ kind: "entry", id: entry.id },
			{ kind: "folder", id: folder.id },
		].sort(byId),
	);
});

it("TRH-DEL-6 휴지통을 모두 비우고 활성 항목은 그대로 둔다", async () => {
	const entry = await createEntry();
	const folder = await createFolder(POSTS);
	const active = await createEntry();
	await moveToTrash(entry.id);
	await moveToTrash(folder.id);
	const before = await entryRow(active.id);

	await montiOf(false).trash.delete({ all: true });

	// TRH-DEL-6.1
	expect({ entry: await entryRow(entry.id), folder: await folderRow(folder.id) }).toEqual({
		entry: undefined,
		folder: undefined,
	});
	// TRH-DEL-6.2
	expect(await entryRow(active.id)).toEqual(before);
});

it("TRH-DEL-7 기준 시각보다 먼저 휴지통에 들어간 항목만 영구 삭제한다", async () => {
	const older = await createEntry();
	const newer = await createEntry();
	await trashEarlier(POSTS, older.id, 2);
	await moveToTrash(newer.id);
	const before = await entryRow(newer.id);

	await montiOf(false).trash.delete({ before: new Date(Date.now() - 60 * 60 * 1000).toISOString() });

	// TRH-DEL-7.1
	expect(await entryRow(older.id)).toBeUndefined();
	// TRH-DEL-7.2
	expect(await entryRow(newer.id)).toEqual(before);
});

it("TRH-DEL-8 대상 중 휴지통에 있지 않은 항목이 하나라도 있으면 아무것도 지우지 않고 거절한다", async () => {
	const trashed = await createEntry();
	const active = await createEntry();
	await moveToTrash(trashed.id);
	const before = { trashed: await entryRow(trashed.id), active: await entryRow(active.id) };

	// TRH-DEL-8.1
	await expect(montiOf(false).trash.delete({ ids: [trashed.id, active.id] })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	// TRH-DEL-8.2
	expect({ trashed: await entryRow(trashed.id), active: await entryRow(active.id) }).toEqual(before);
});
