import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { columnsOf, createTestDatabase, type TestDatabase, tableExists } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { CollectionSchema, Schema } from "../../engine/types";
import { entries } from "../entries/entries";
import { schema } from "./schema";
import { syncSchemaTables } from "./sync-tables";

let testDb: TestDatabase;
let db: Kysely<Database>;
let dir: string;
let schemaFile: string;
let configFile: string;

const empty: Schema = { locales: ["ko"], collections: {} };

const original: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text" } } } },
};

const changed: Schema = {
	locales: ["ko", "en"],
	collections: {
		posts: {
			body: true,
			label: "글",
			description: "블로그 글",
			fields: {
				title: { type: "text", required: true, max: 80, label: "제목", description: "목록에 보인다" },
				views: { type: "number" },
				pinned: { type: "boolean" },
				publishedOn: { type: "date" },
				category: { type: "select", options: ["news", "guide"], many: true },
				cover: { type: "media", many: false },
				tags: { type: "relation", to: "tags", many: true },
				hero: {
					type: "conditional",
					options: {
						image: { fields: { image: { type: "media" } } },
						quote: { fields: { text: { type: "text", max: 200 }, author: { type: "text" } } },
					},
				},
			},
		},
		tags: { fields: { label: { type: "text" } } },
	},
};

/** 정의된 8종이 아닌 `type`을 가진 필드: 타입 검사를 거치지 않은 호출자가 보내는 모양이다. */
const unknownType: Schema = JSON.parse(
	JSON.stringify({ locales: ["ko"], collections: { posts: { fields: { title: { type: "richtext" } } } } }),
);

function withCollections(collections: Record<string, CollectionSchema>): Schema {
	return { locales: ["ko"], collections };
}

/** `applied` 스키마가 파일과 DB에 적용된 상태에서 `schema`·`entries` 리소스를 가진 엔진. */
async function montiOf(dev: boolean, applied: Schema = original) {
	await writeFile(schemaFile, `export default ${JSON.stringify(applied)};\n`);
	await syncSchemaTables(db, applied);
	return createMonti(db, { schema, entries }, [], {
		schema: applied,
		config: { name: "Monti Blog", dev },
		schemaFile,
		configFile,
	});
}

/** 앱이 가져오는 방식대로 읽은 스키마 파일의 값. 테스트마다 행동 뒤에 한 번만 가져온다. */
async function schemaInFile(): Promise<Schema> {
	const module: { default: Schema } = await import(schemaFile);
	return module.default;
}

/** 열이 외래 키로 가리키는 테이블 이름. 외래 키가 없으면 `null`. */
async function referencedTable(table: string, column: string): Promise<string | null> {
	const { rows } = await sql<{ target: string }>`
		select target.relname as target
		from pg_constraint k
		join pg_class source on source.oid = k.conrelid
		join pg_class target on target.oid = k.confrelid
		join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
		where k.contype = 'f' and source.relname = ${table} and a.attname = ${column}
	`.execute(db);
	return rows[0]?.target ?? null;
}

async function dataTypeOf(table: string, column: string): Promise<string | undefined> {
	const { rows } = await sql<{ data_type: string }>`
		select format_type(a.atttypid, a.atttypmod) as data_type from pg_attribute a
		where a.attrelid = ${table}::regclass and a.attname = ${column} and not a.attisdropped
	`.execute(db);
	return rows[0]?.data_type;
}

async function tablesExisting(names: string[]): Promise<string[]> {
	const found: string[] = [];
	for (const name of names) if (await tableExists(testDb.db, name)) found.push(name);
	return found;
}

/** 실행해서 던진 오류 코드. 오류가 없으면 `null`. */
async function codeOf(run: Promise<unknown>): Promise<string | null> {
	return run.then(
		() => null,
		(error: { code: string }) => error.code,
	);
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "@monti-cms/core", [initial]);
	db = testDb.db as Kysely<Database>;
	dir = await mkdtemp(path.join(tmpdir(), "monti-schema-"));
	schemaFile = path.join(dir, "monti.schema.ts");
	configFile = path.join(dir, "monti.config.ts");
	await writeFile(configFile, `export default { name: "Monti Blog" };\n`);
});

afterEach(async () => {
	await testDb.drop();
	await rm(dir, { recursive: true });
});

it("SCH-GET-1 현재 스키마를 돌려준다", async () => {
	const monti = await montiOf(false);

	// SCH-GET-1.1
	expect(await monti.schema.get({})).toEqual(original);
});

it("SCH-UPD-1 개발 서버에서 스키마를 바꾸면 현재 스키마와 스키마 파일에 새 스키마가 기록된다", async () => {
	const monti = await montiOf(true);

	const output = await monti.schema.update(changed);

	// SCH-UPD-1.1
	expect(output).toEqual(changed);
	// SCH-UPD-1.2
	expect(await monti.schema.get({})).toEqual(changed);
	// SCH-UPD-1.3
	expect(await schemaInFile()).toEqual(changed);
});

it("SCH-UPD-2 컬렉션을 추가하면 글 기본 테이블과 글자·숫자·참거짓·날짜·선택지 열을 가진 데이터 테이블이 만들어진다", async () => {
	const monti = await montiOf(true, empty);

	await monti.schema.update(
		withCollections({
			posts: {
				body: true,
				fields: {
					title: { type: "text" },
					views: { type: "number" },
					pinned: { type: "boolean" },
					day: { type: "date" },
					category: { type: "select", options: ["news", "guide"] },
					labels: { type: "select", options: ["a", "b"], many: true },
				},
			},
			notes: { fields: {} },
		}),
	);

	// SCH-UPD-2.1
	expect(await columnsOf(testDb.db, "posts")).toEqual(["folder_id", "id", "source_locale", "trashed_at"]);
	// SCH-UPD-2.2
	expect(await columnsOf(testDb.db, "posts_data")).toEqual([
		"body",
		"category",
		"day",
		"entry_id",
		"labels",
		"locale",
		"pinned",
		"published_at",
		"slug",
		"status",
		"title",
		"translation_seen",
		"views",
	]);
	// SCH-UPD-2.3
	expect(await dataTypeOf("notes_data", "body")).toBeUndefined();
});

it("SCH-UPD-3 하나를 고르는 미디어·관계 필드는 데이터 테이블의 외래 키 열로 만들어진다", async () => {
	const authors: CollectionSchema = { fields: { name: { type: "text" } } };
	const monti = await montiOf(true, withCollections({ authors }));

	await monti.schema.update(
		withCollections({
			authors,
			posts: { fields: { cover: { type: "media" }, author: { type: "relation", to: "authors" } } },
		}),
	);

	// SCH-UPD-3.1
	expect(await referencedTable("posts_data", "cover")).toBe("media");
	// SCH-UPD-3.2
	expect(await referencedTable("posts_data", "author")).toBe("authors");
});

it("SCH-UPD-4 여러 개를 고르는 미디어·관계 필드는 순서를 저장하는 연결 테이블로 만들어지고 데이터 테이블에는 열을 만들지 않는다", async () => {
	const targets = { authors: { fields: {} }, tags: { fields: {} } };
	const monti = await montiOf(true, withCollections(targets));

	await monti.schema.update(
		withCollections({
			...targets,
			posts: {
				fields: {
					author: { type: "relation", to: "authors" },
					gallery: { type: "media", many: true },
					tags: { type: "relation", to: "tags", many: true },
				},
			},
		}),
	);

	// SCH-UPD-4.1
	expect(await columnsOf(testDb.db, "posts_rels")).toEqual([
		"entry_id",
		"locale",
		"media_id",
		"path",
		"position",
		"status",
		"tags_id",
	]);
	// SCH-UPD-4.2
	expect([await dataTypeOf("posts_data", "gallery"), await dataTypeOf("posts_data", "tags")]).toEqual([
		undefined,
		undefined,
	]);
});

it("SCH-UPD-5 조건부 필드는 선택한 분기 열과 각 분기의 하위 입력칸 열·연결 테이블로 펼쳐져 만들어진다", async () => {
	const tags: CollectionSchema = { fields: {} };
	const monti = await montiOf(true, withCollections({ tags }));

	await monti.schema.update(
		withCollections({
			tags,
			products: {
				fields: {
					discount: {
						type: "conditional",
						options: {
							yes: {
								fields: { price: { type: "number" }, badges: { type: "relation", to: "tags", many: true } },
							},
						},
					},
				},
			},
		}),
	);
	const columns = await columnsOf(testDb.db, "products_data");

	// SCH-UPD-5.1
	expect(columns).toContain("discount");
	// SCH-UPD-5.2
	expect(columns).toContain("discount__yes__price");
	// SCH-UPD-5.3
	expect(await columnsOf(testDb.db, "products_rels")).toContain("tags_id");
});

it("SCH-UPD-6 컬렉션에 필드를 새로 넣으면 열이 추가되고 기존 필드를 빼면 열이 삭제되며 바꾸지 않은 필드의 값은 유지된다", async () => {
	const keep_field = { type: "text" as const };
	const monti = await montiOf(
		true,
		withCollections({ posts: { fields: { keep_field, old_field: { type: "text" } } } }),
	);
	const id = randomUUID();
	await sql`insert into posts (id, source_locale) values (${id}, 'ko')`.execute(db);
	await sql`insert into posts_data (entry_id, locale, status, keep_field, old_field)
		values (${id}, 'ko', 'draft', '남길 값', '지울 값')`.execute(db);

	await monti.schema.update(withCollections({ posts: { fields: { keep_field, new_field: { type: "text" } } } }));
	const columns = await columnsOf(testDb.db, "posts_data");
	const { rows } = await sql<{ keep_field: string }>`select keep_field from posts_data`.execute(db);

	// SCH-UPD-6.1
	expect(columns).toContain("new_field");
	// SCH-UPD-6.2
	expect(columns).not.toContain("old_field");
	// SCH-UPD-6.3
	expect(rows).toEqual([{ keep_field: "남길 값" }]);
});

it("SCH-UPD-7 필드의 종류나 관계 대상을 바꾸면 데이터 테이블의 열도 새 종류로 바뀌고 변환 가능한 값은 유지되며 호환되지 않는 값은 비워진다", async () => {
	const people = { authors: { fields: {} }, members: { fields: {} } };
	const category = { type: "select" as const, options: ["news", "tech"] };
	const labels = { type: "select" as const, options: ["a", "b"] };
	const monti = await montiOf(
		true,
		withCollections({
			...people,
			posts: {
				fields: {
					code: { type: "number" },
					flag: { type: "boolean" },
					active: { type: "boolean" },
					event_at: { type: "date" },
					category,
					labels: { ...labels, many: true },
					score: { type: "text" },
					note: { type: "text" },
					owner: { type: "relation", to: "authors" },
				},
			},
		}),
	);
	const [id, author] = [randomUUID(), randomUUID()];
	await sql`insert into authors (id, source_locale) values (${author}, 'ko')`.execute(db);
	await sql`insert into posts (id, source_locale) values (${id}, 'ko')`.execute(db);
	await sql`insert into posts_data (entry_id, locale, status, code, flag, active, event_at, category, labels, score, note, owner)
		values (${id}, 'ko', 'draft', 42, true, true, '2026-11-20T01:00:00Z', 'news', array['a', 'b'], '3.5', 'hello', ${author})`.execute(
		db,
	);
	// 날짜를 글자로 바꾼 값은 DB 세션의 시간대를 따르므로, 바꾸기 전에 DB가 글자로 쓴 값과 비교한다.
	const before = await sql<{ event_at: string }>`select event_at::text as event_at from posts_data`.execute(db);

	await monti.schema.update(
		withCollections({
			...people,
			posts: {
				fields: {
					code: { type: "text" },
					flag: { type: "number" },
					active: { type: "text" },
					event_at: { type: "text" },
					category: { ...category, many: true },
					labels,
					score: { type: "number" },
					note: { type: "number" },
					owner: { type: "relation", to: "members" },
				},
			},
		}),
	);
	const { rows } = await sql<Record<string, unknown>>`select * from posts_data`.execute(db);
	const typesOf = (columns: string[]) => Promise.all(columns.map((column) => dataTypeOf("posts_data", column)));

	// SCH-UPD-7.1
	expect({
		types: await typesOf(["code", "active", "event_at"]),
		values: [rows[0]?.code, rows[0]?.active, rows[0]?.event_at],
	}).toEqual({
		types: ["text", "text", "text"],
		values: ["42", "true", before.rows[0]?.event_at],
	});
	// SCH-UPD-7.2
	expect({ type: await dataTypeOf("posts_data", "flag"), value: rows[0]?.flag }).toEqual({
		type: "double precision",
		value: null,
	});
	// SCH-UPD-7.3
	expect({ types: await typesOf(["category", "labels"]), values: [rows[0]?.category, rows[0]?.labels] }).toEqual({
		types: ["text[]", "text"],
		values: [["news"], "a"],
	});
	// SCH-UPD-7.4
	expect({ score: rows[0]?.score, note: rows[0]?.note, owner: rows[0]?.owner }).toEqual({
		score: 3.5,
		note: null,
		owner: null,
	});
});

it("SCH-UPD-8 스키마에서 컬렉션을 지우면 그 컬렉션의 테이블들이 모두 삭제된다", async () => {
	const monti = await montiOf(true);

	await monti.schema.update(empty);

	// SCH-UPD-8.1
	expect(await tablesExisting(["posts", "posts_data", "posts_rels"])).toEqual([]);
});

/** `authors`·`members`와, 다건 `relation` 필드 `contributors`가 `to` 컬렉션을 가리키는 `posts`가 있는 스키마. */
function withContributors(to: string): Schema {
	return withCollections({
		authors: { fields: {} },
		members: { fields: {} },
		posts: { fields: { title: { type: "text" }, contributors: { type: "relation", to, many: true } } },
	});
}

it("SCH-UPD-17 값이 들어 있는 다건 관계 필드의 대상을 바꿔도 기존 글을 정상적으로 읽고 수정·발행할 수 있다", async () => {
	const monti = await montiOf(true, withContributors("authors"));
	const author = await monti.entries.create({ collection: "authors", locale: "ko" });
	const post = await monti.entries.create({
		collection: "posts",
		locale: "ko",
		slug: "hello",
		fields: { title: "옛 제목", contributors: [author.id] },
	});

	await monti.schema.update(withContributors("members"));
	const draft = await monti.entries.get({ id: post.id, status: "draft" });

	// SCH-UPD-17.1
	expect(draft.fields).not.toHaveProperty("contributors");

	await monti.entries.update({ id: post.id, fields: { ...draft.fields, title: "새 제목" } });
	const published = await monti.entries.publish({ id: post.id });

	// SCH-UPD-17.2
	expect(published).toMatchObject({ fields: { title: "새 제목" }, published_at: expect.any(Date) });
});

it("SCH-UPD-9 개발 서버가 아니면 스키마를 수정할 수 없다", async () => {
	const monti = await montiOf(false);

	// SCH-UPD-9.1
	await expect(monti.schema.update(changed)).rejects.toMatchObject({ code: "FORBIDDEN" });
	// SCH-UPD-9.2
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-9.3
	expect(await schemaInFile()).toEqual(original);
});

it("SCH-UPD-10 트랜잭션이 실패해 롤백되면 DB 테이블과 스키마 파일은 원래대로 유지된다", async () => {
	const monti = await montiOf(true);
	const rollback = new Error("롤백");

	await monti
		.transaction(async (tx) => {
			await tx.schema.update(changed);
			throw rollback;
		})
		.catch((error: unknown) => {
			if (error !== rollback) throw error;
		});

	// SCH-UPD-10.1
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-10.2
	expect(await schemaInFile()).toEqual(original);
	// SCH-UPD-10.3
	expect(await tablesExisting(["tags", "tags_data", "tags_rels"])).toEqual([]);
});

it("SCH-UPD-11 드라이런으로 실행하면 DB 테이블과 스키마 파일은 원래대로 유지된다", async () => {
	const monti = await montiOf(true);

	await monti.dryRun(async (tx) => {
		await tx.schema.update(changed);
	});

	// SCH-UPD-11.1
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-11.2
	expect(await schemaInFile()).toEqual(original);
	// SCH-UPD-11.3
	expect(await tablesExisting(["tags", "tags_data", "tags_rels"])).toEqual([]);
});

it("SCH-UPD-12 지원하지 않는 필드 종류가 들어 있으면 스키마를 수정할 수 없다", async () => {
	const monti = await montiOf(true);

	// SCH-UPD-12.1
	await expect(monti.schema.update(unknownType)).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// SCH-UPD-12.2
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-12.3
	expect(await schemaInFile()).toEqual(original);
});

it("SCH-UPD-13 코어 기본 테이블 이름이나 `_data`·`_rels`로 끝나는 이름은 컬렉션 이름으로 쓸 수 없다", async () => {
	const monti = await montiOf(true);
	const reserved = [
		"templates",
		"folders",
		"media",
		"media_uses",
		"loose_files",
		"admin",
		"session",
		"api_keys",
		"migrations",
		"posts_data",
		"posts_rels",
	];

	const codes: (string | null)[] = [];
	for (const key of reserved) codes.push(await codeOf(monti.schema.update(withCollections({ [key]: { fields: {} } }))));

	// SCH-UPD-13.1
	expect(codes).toEqual(reserved.map(() => "BAD_REQUEST"));
	// SCH-UPD-13.2
	expect(await monti.schema.get({})).toEqual(original);
});

it("SCH-UPD-14 데이터 테이블의 고정 열 이름은 컬렉션의 필드 이름으로 쓸 수 없다", async () => {
	const monti = await montiOf(true);
	const title = { type: "text" as const };
	const fixedNames = [
		withCollections({ posts: { fields: { title, status: { type: "text" } } } }),
		withCollections({ posts: { fields: { slug: { type: "text" } } } }),
		withCollections({ posts: { fields: { body: { type: "text" } } } }),
		withCollections({
			posts: {
				fields: { hero: { type: "conditional", options: { quote: { fields: { status: { type: "text" } } } } } },
			},
		}),
	];

	const codes: (string | null)[] = [];
	for (const next of fixedNames) codes.push(await codeOf(monti.schema.update(next)));

	// SCH-UPD-14.1
	expect(codes).toEqual(fixedNames.map(() => "BAD_REQUEST"));
	// SCH-UPD-14.2
	expect(await monti.schema.get({})).toEqual(original);
});

/** `option` 분기에 `subfield` 하나를 가진 조건부 필드 `field`만 있는 `posts` 스키마. */
function withSubfield(field: string, option: string, subfield: string): Schema {
	return withCollections({
		posts: {
			fields: { [field]: { type: "conditional", options: { [option]: { fields: { [subfield]: { type: "text" } } } } } },
		},
	});
}

it("SCH-UPD-15 키나 만들어질 테이블·열 이름이 63바이트를 넘거나 금지된 기호가 들어 있으면 스키마를 저장할 수 없다", async () => {
	const monti = await montiOf(true);
	// 한글 한 글자는 UTF-8로 3바이트다. 컬렉션 키 58바이트에 `_data`·`_rels`가 붙으면 63바이트이고, 필드 키는 21자로 63바이트다.
	const exact = withCollections({ ["c".repeat(58)]: { fields: { ["가".repeat(21)]: { type: "text" } } } });
	const rejected = [
		// 다건 미디어 필드의 키가 22자로 66바이트다.
		withCollections({ posts: { fields: { ["가".repeat(22)]: { type: "media", many: true } } } }),
		// 하위 필드 열 이름 `배치__강조__설명설명…`은 24자지만 UTF-8로 64바이트다. 각 키는 63바이트 안이다.
		withSubfield("배치", "강조", "설명".repeat(8)),
		// 컬렉션 키는 59바이트지만 `_data`가 붙으면 64바이트다.
		withCollections({ ["c".repeat(59)]: { fields: {} } }),
		withCollections({ 'po"sts': { fields: {} } }),
		withCollections({ posts: { fields: { "cover.alt": { type: "text" } } } }),
		withSubfield("hero", "big__image", "caption"),
		withSubfield("hero", "quote", 'say"ing'),
	];

	// SCH-UPD-15.2
	await expect(monti.schema.update(exact)).resolves.toEqual(exact);
	const codes: (string | null)[] = [];
	for (const next of rejected) codes.push(await codeOf(monti.schema.update(next)));

	// SCH-UPD-15.1
	expect(codes).toEqual(rejected.map(() => "BAD_REQUEST"));
	// SCH-UPD-15.3
	expect(await monti.schema.get({})).toEqual(exact);
});

it("SCH-UPD-16 관계 필드가 스키마에 없는 컬렉션을 가리키면 스키마를 저장할 수 없다", async () => {
	const monti = await montiOf(true);
	const author = { type: "relation" as const, to: "authors" };
	const toFolders = withCollections({
		authors: { fields: {} },
		posts: { fields: { author, folder: { type: "relation", to: "folders" } } },
	});
	const toMissing = withCollections({
		posts: {
			fields: {
				related: { type: "relation", to: "posts" },
				layout: { type: "conditional", options: { hero: { fields: { author } } } },
			},
		},
	});

	const codes = [await codeOf(monti.schema.update(toFolders)), await codeOf(monti.schema.update(toMissing))];

	// SCH-UPD-16.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// SCH-UPD-16.2
	expect(await monti.schema.get({})).toEqual(original);
});
