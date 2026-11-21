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

/** `applied` 스키마가 파일과 DB에 적용된 상태의 엔진. */
async function montiOf(dev: boolean, applied: Schema = original) {
	await writeFile(schemaFile, `export default ${JSON.stringify(applied)};\n`);
	await syncSchemaTables(db, applied);
	return createMonti(db, { schema }, [], {
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
	await migrate(testDb.db, "core", [initial]);
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

it("SCH-UPD-4 여러 개를 고르는 미디어·관계 필드는 순서를 저장하는 연결 테이블로 만들어진다", async () => {
	const tags: CollectionSchema = { fields: { label: { type: "text" } } };
	const monti = await montiOf(true, withCollections({ tags }));

	await monti.schema.update(
		withCollections({
			tags,
			posts: {
				fields: {
					gallery: { type: "media", many: true },
					topics: { type: "relation", to: "tags", many: true },
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
});

it("SCH-UPD-5 조건부 필드는 선택한 분기 열과 각 분기의 하위 입력칸 열로 펼쳐져 만들어진다", async () => {
	const monti = await montiOf(true, empty);

	await monti.schema.update(
		withCollections({
			products: {
				fields: {
					discount: { type: "conditional", options: { yes: { fields: { price: { type: "number" } } } } },
				},
			},
		}),
	);
	const columns = await columnsOf(testDb.db, "products_data");

	// SCH-UPD-5.1
	expect(columns).toContain("discount");
	// SCH-UPD-5.2
	expect(columns).toContain("discount__yes__price");
});

it("SCH-UPD-6 컬렉션에 필드를 새로 넣으면 열이 추가되고 기존 필드를 빼면 열이 삭제된다", async () => {
	const monti = await montiOf(true, withCollections({ posts: { fields: { old_field: { type: "text" } } } }));

	await monti.schema.update(withCollections({ posts: { fields: { new_field: { type: "text" } } } }));
	const columns = await columnsOf(testDb.db, "posts_data");

	// SCH-UPD-6.1
	expect(columns).toContain("new_field");
	// SCH-UPD-6.2
	expect(columns).not.toContain("old_field");
});

it("SCH-UPD-7 필드의 종류를 바꾸면 데이터 테이블의 열도 새 종류로 바뀌고 변환 가능한 값은 유지되며 호환되지 않는 값은 비워진다", async () => {
	const category = { type: "select" as const, options: ["news", "tech"] };
	const monti = await montiOf(
		true,
		withCollections({
			posts: {
				fields: {
					code: { type: "number" },
					flag: { type: "boolean" },
					category,
					score: { type: "text" },
					note: { type: "text" },
				},
			},
		}),
	);
	const id = randomUUID();
	await sql`insert into posts (id, source_locale) values (${id}, 'ko')`.execute(db);
	await sql`insert into posts_data (entry_id, locale, status, code, flag, category, score, note)
		values (${id}, 'ko', 'draft', 42, true, 'news', '3.5', 'hello')`.execute(db);

	await monti.schema.update(
		withCollections({
			posts: {
				fields: {
					code: { type: "text" },
					flag: { type: "number" },
					category: { ...category, many: true },
					score: { type: "number" },
					note: { type: "number" },
				},
			},
		}),
	);
	const { rows } = await sql<Record<string, unknown>>`select code, flag, category, score, note from posts_data`.execute(
		db,
	);

	// SCH-UPD-7.1
	expect({ type: await dataTypeOf("posts_data", "code"), value: rows[0]?.code }).toEqual({ type: "text", value: "42" });
	// SCH-UPD-7.2
	expect({ type: await dataTypeOf("posts_data", "flag"), value: rows[0]?.flag }).toEqual({
		type: "double precision",
		value: null,
	});
	// SCH-UPD-7.3
	expect({ type: await dataTypeOf("posts_data", "category"), value: rows[0]?.category }).toEqual({
		type: "text[]",
		value: ["news"],
	});
	// SCH-UPD-7.4
	expect({ score: rows[0]?.score, note: rows[0]?.note }).toEqual({ score: 3.5, note: null });
});

it("SCH-UPD-8 스키마에서 컬렉션을 지우면 그 컬렉션의 테이블들이 모두 삭제된다", async () => {
	const monti = await montiOf(true);

	await monti.schema.update(empty);

	// SCH-UPD-8.1
	expect(await tablesExisting(["posts", "posts_data", "posts_rels"])).toEqual([]);
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

	const codes = [
		await codeOf(monti.schema.update(withCollections({ media: { fields: {} } }))),
		await codeOf(monti.schema.update(withCollections({ posts_data: { fields: {} } }))),
	];

	// SCH-UPD-13.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// SCH-UPD-13.2
	expect(await monti.schema.get({})).toEqual(original);
});

it("SCH-UPD-14 데이터 테이블의 고정 열 이름은 컬렉션의 필드 이름으로 쓸 수 없다", async () => {
	const monti = await montiOf(true);

	const codes = [
		await codeOf(monti.schema.update(withCollections({ posts: { fields: { status: { type: "text" } } } }))),
		await codeOf(monti.schema.update(withCollections({ posts: { fields: { slug: { type: "text" } } } }))),
	];

	// SCH-UPD-14.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// SCH-UPD-14.2
	expect(await monti.schema.get({})).toEqual(original);
});
