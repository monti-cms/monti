import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	columnDefinitionsOf,
	createTestDatabase,
	recordedMigrations,
	type TestDatabase,
	tableExists,
} from "./__test__/database";
import { initial } from "./db/migrations/0001-initial";
import type { Database, Migration } from "./db/types";
import { defineWrite } from "./engine/operation";
import type { MontiConfig, Plugin, Schema } from "./engine/types";
import { migrate, planSchemaDiff, snapshotOf, specOf, startMonti } from "./index";

let testDb: TestDatabase;
let db: Kysely<Database>;
let dir: string;
let schemaFile: string;
let configFile: string;

const schema: Schema = { locales: ["ko"], collections: { posts: { fields: { title: { type: "text" } } } } };

/** 8종 밖의 `type`을 가진 필드가 있는 스키마: 타입 없이 부르는 쪽이 보내는 그대로. */
const unknownType: Schema = JSON.parse(
	JSON.stringify({ locales: ["ko"], collections: { posts: { fields: { title: { type: "richtext" } } } } }),
);

const empty: Schema = { locales: ["ko"], collections: {} };

/** 본문, 단건·다건 미디어와 관계, 조건부 필드를 가진 `posts`와 그 관계 대상 `authors`. */
const blog: Schema = {
	locales: ["ko"],
	collections: {
		authors: { fields: {} },
		posts: {
			body: true,
			fields: {
				cover: { type: "media" },
				gallery: { type: "media", many: true },
				author: { type: "relation", to: "authors" },
				reviewers: { type: "relation", to: "authors", many: true },
				hero: { type: "conditional", options: { quote: { fields: { text: { type: "text" } } } } },
			},
		},
	},
};

const people = { authors: { fields: {} }, members: { fields: {} } };
const category = { type: "select" as const, options: ["news", "tech"] };

/** 바꾸기 전 스키마: 지울 `legacy` 컬렉션과, 종류·관계 대상을 바꿀 필드와 지울 필드를 가진 `posts`. */
const beforeChange: Schema = {
	locales: ["ko"],
	collections: {
		...people,
		legacy: { fields: {} },
		posts: {
			fields: {
				code: { type: "number" },
				category,
				author: { type: "relation", to: "authors" },
				writer: { type: "relation", to: "authors" },
				old_col: { type: "text" },
			},
		},
	},
};

/** 바꾼 뒤 스키마: `legacy`를 지우고, `posts`의 필드 종류·관계 대상을 바꾸고, `old_col` 대신 `new_col`을 둔다. */
const afterChange: Schema = {
	locales: ["ko"],
	collections: {
		...people,
		posts: {
			fields: {
				code: { type: "text" },
				category: { ...category, many: true },
				author: { type: "text" },
				writer: { type: "relation", to: "members" },
				new_col: { type: "text" },
			},
		},
	},
};

/** `core.md` 7절 표의 `리소스.동작` 전체. */
const coreOperations = [
	"entries.list",
	"entries.get",
	"entries.create",
	"entries.update",
	"entries.publish",
	"entries.unpublish",
	"entries.duplicate",
	"entries.replaceReferences",
	"entries.addLocale",
	"entries.removeLocale",
	"entries.setSourceLocale",
	"translationStatus.list",
	"translationStatus.get",
	"translationStatus.update",
	"templates.list",
	"templates.get",
	"templates.create",
	"templates.update",
	"templates.delete",
	"folders.list",
	"folders.create",
	"folders.update",
	"media.list",
	"media.get",
	"media.create",
	"media.update",
	"media.startUpload",
	"trash.list",
	"trash.get",
	"trash.delete",
	"trash.move",
	"trash.restore",
	"schema.get",
	"schema.update",
	"config.get",
	"config.update",
	"keys.list",
	"keys.create",
	"keys.update",
	"keys.delete",
	"keys.check",
	"session.get",
	"session.create",
	"session.delete",
	"admin.create",
	"admin.update",
];

beforeEach(async () => {
	testDb = await createTestDatabase();
	db = testDb.db as Kysely<Database>;
	dir = await mkdtemp(path.join(tmpdir(), "monti-start-"));
	schemaFile = path.join(dir, "monti.schema.ts");
	configFile = path.join(dir, "monti.config.ts");
	await writeFile(schemaFile, `export default ${JSON.stringify(schema)};\n`);
	await writeFile(configFile, `export default { name: "Monti Blog" };\n`);
});

afterEach(async () => {
	await testDb.drop();
	await rm(dir, { recursive: true });
});

function start(plugins: Plugin[], startSchema: Schema = schema, config: Partial<MontiConfig> = {}) {
	return startMonti({
		db,
		schema: startSchema,
		config: { name: "Monti Blog", plugins, ...config },
		schemaFile,
		configFile,
	});
}

/** 코어 테이블을 가리키는 플러그인 테이블: 코어 마이그레이션 뒤에만 만들 수 있다. */
async function createPhotos(pluginDb: Kysely<unknown>): Promise<void> {
	await pluginDb.schema
		.createTable("albums_photos")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("folder_id", "uuid", (column) => column.references("folders.id"))
		.execute();
}

async function tagRun(input: { name: string }): Promise<{ tag: string }> {
	return { tag: input.name };
}

/** 앱의 마이그레이션 단계가 만드는 테이블. */
async function createNotes(appDb: Kysely<unknown>): Promise<void> {
	await appDb.schema
		.createTable("app_notes")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.execute();
}

/** 마이그레이션 CLI가 만든 파일처럼 DDL 문장들을 차례로 실행한다. */
async function runStatements(statements: string[]): Promise<void> {
	for (const statement of statements) await sql.raw(statement).execute(db);
}

it("START-1 시작하면 코어와 플러그인의 마이그레이션을 코어 먼저 실행한다", async () => {
	const plugin: Plugin = { name: "albums", migrations: [{ name: "photos", up: createPhotos }] };

	await start([plugin]);

	// START-1.1
	expect(await recordedMigrations(testDb.db)).toEqual([
		["albums", "photos"],
		["core", initial.name],
	]);
	// START-1.2
	expect(await tableExists(testDb.db, "albums_photos")).toBe(true);
});

it("START-2 `monti` 객체로 코어 리소스와 플러그인 Operation을 모두 실행할 수 있다", async () => {
	const tag = defineWrite({ input: z.object({ name: z.string() }), run: tagRun });
	const plugin: Plugin = { name: "albums", operations: { albums: { tag } } };

	const monti = await start([plugin]);
	const folder = await monti.folders.create({ scope: "media", name: "Photos" });
	// 플러그인 Operation은 `monti`의 타입에 없으므로 이름으로 꺼낸다.
	const albums: { tag: (input: { name: string }) => Promise<{ tag: string }> } = Reflect.get(monti, "albums");
	const output = await albums.tag({ name: "Summer" });

	// START-2.1
	expect(await db.selectFrom("folders").select(["id", "name"]).execute()).toEqual([{ id: folder.id, name: "Photos" }]);
	// START-2.2
	expect(output).toEqual({ tag: "Summer" });
});

it("START-3 스키마에 지원하지 않는 필드 종류가 들어 있으면 마이그레이션 전에 시작을 거절한다", async () => {
	const started = start([], unknownType);

	// START-3.1
	await expect(started).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// START-3.2
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
});

it("START-4 플러그인의 키 서비스가 `keys.check`에 연결된다", async () => {
	const check = vi.fn<(secret: string) => Promise<void>>().mockResolvedValue(undefined);
	const plugin: Plugin = { name: "mail", keyServices: [{ service: "mail", check }] };

	const monti = await start([plugin]);
	await monti.keys.check({ service: "mail", secret: "mail-secret-1234" });

	// START-4.1
	expect(check).toHaveBeenCalledExactlyOnceWith("mail-secret-1234");
});

it("START-5 `monti` 객체의 명세에 코어의 모든 Operation이 들어 있다", async () => {
	const monti = await start([]);

	const names = monti.spec().map((entry) => entry.name);

	// START-5.1
	expect(names.sort()).toEqual([...coreOperations].sort());
});

it("START-6 개발 서버로 시작하면 스키마에 정의된 컬렉션 테이블을 DB에 준비한다", async () => {
	await start([], schema, { dev: true });

	// START-6.1
	expect({ posts: await tableExists(testDb.db, "posts"), data: await tableExists(testDb.db, "posts_data") }).toEqual({
		posts: true,
		data: true,
	});
});

it("START-7 운영 서버로 시작하면 등록된 마이그레이션만 실행하고 컬렉션 테이블은 자동으로 만들지 않는다", async () => {
	await start([], schema, { dev: false });

	// START-7.1
	expect({
		migrations: await tableExists(testDb.db, "migrations"),
		posts: await tableExists(testDb.db, "posts"),
		data: await tableExists(testDb.db, "posts_data"),
	}).toEqual({ migrations: true, posts: false, data: false });
});

it("START-8 관리자·세션·키 리소스의 쓰기는 이벤트 구독자에게 통지하지 않는다", async () => {
	const monti = await startMonti({
		db,
		schema,
		config: { name: "Monti Blog" },
		schemaFile,
		configFile,
		secret: "test monti secret",
	});
	const listener = vi.fn();
	monti.onEvent(listener);
	const account = { email: "admin@example.com", password: "admin-password" };

	await monti.admin.create(account);
	await monti.session.create(account);
	await monti.keys.create({ service: "mail", name: "Mail", secret: "mail-secret-1234" });

	// START-8.1
	expect(listener).not.toHaveBeenCalled();
});

it("START-9 DB 연결 없이도 코어와 플러그인의 Operation 명세를 얻을 수 있다", async () => {
	const tag = defineWrite({ input: z.object({ name: z.string() }), run: tagRun });
	const plugin: Plugin = { name: "albums", operations: { albums: { tag } } };

	const spec = specOf([plugin]);
	const monti = await start([plugin]);

	// START-9.1
	expect(spec.map((entry) => entry.name).sort()).toEqual([...coreOperations, "albums.tag"].sort());
	// START-9.2
	expect(spec).toEqual(monti.spec());
});

it("START-10 공개 마이그레이션 실행기로 앱 범위의 마이그레이션 단계를 실행할 수 있다", async () => {
	await migrate(db, "core", [initial]);
	const step: Migration = { name: "0001-notes", up: createNotes };

	await migrate(db, "app", [step]);

	// START-10.1
	expect(await tableExists(testDb.db, "app_notes")).toBe(true);
	// START-10.2
	expect(await recordedMigrations(testDb.db)).toContainEqual(["app", step.name]);
});

it("START-11 빈 스냅샷과 새 스키마의 차이를 SQL로 생성해 적용하면 개발 서버 동기화와 같은 테이블과 열이 만들어진다", async () => {
	await migrate(db, "core", [initial]);

	await runStatements(planSchemaDiff(snapshotOf(empty), blog));

	// START-11.1
	expect({
		posts: await columnDefinitionsOf(testDb.db, "posts"),
		data: await columnDefinitionsOf(testDb.db, "posts_data"),
		rels: await columnDefinitionsOf(testDb.db, "posts_rels"),
	}).toEqual({
		posts: {
			id: "uuid",
			source_locale: "text",
			folder_id: "uuid references folders",
			trashed_at: "timestamp with time zone",
		},
		data: {
			entry_id: "uuid references posts",
			locale: "text",
			status: "text",
			slug: "text",
			published_at: "timestamp with time zone",
			translation_seen: "jsonb",
			body: "jsonb",
			cover: "uuid references media",
			author: "uuid references authors",
			hero: "text",
			hero__quote__text: "text",
		},
		rels: {
			entry_id: "uuid",
			locale: "text",
			status: "text",
			path: "text",
			position: "integer",
			media_id: "uuid references media",
			authors_id: "uuid references authors",
		},
	});
	// START-11.2
	expect(planSchemaDiff(snapshotOf(blog), blog)).toEqual([]);
});

it("START-12 스키마 변경 SQL은 열 추가·타입 변환·외래 키 대상 교체·열 삭제·컬렉션 삭제를 실제 DB에서 정상 실행한다", async () => {
	await start([], beforeChange, { dev: true });
	const [post, author] = [randomUUID(), randomUUID()];
	await sql`insert into authors (id, source_locale) values (${author}, 'ko')`.execute(db);
	await sql`insert into posts (id, source_locale) values (${post}, 'ko')`.execute(db);
	await sql`insert into posts_data (entry_id, locale, status, code, category, author, writer, old_col)
		values (${post}, 'ko', 'draft', 42, 'news', ${author}, ${author}, '지울 값')`.execute(db);
	const previous = snapshotOf(beforeChange);

	await runStatements(planSchemaDiff(previous, afterChange));
	const columns = await columnDefinitionsOf(testDb.db, "posts_data");
	const { rows } = await sql<Record<string, unknown>>`
		select code, category, author, writer from posts_data
	`.execute(db);
	const legacy = ["legacy", "legacy_data", "legacy_rels"].map((table) => tableExists(testDb.db, table));

	// START-12.1
	expect({ legacy: await Promise.all(legacy), new_col: columns.new_col, old_col: columns.old_col }).toEqual({
		legacy: [false, false, false],
		new_col: "text",
		old_col: undefined,
	});
	// START-12.2
	expect({ code: [columns.code, rows[0]?.code], category: [columns.category, rows[0]?.category] }).toEqual({
		code: ["text", "42"],
		category: ["text[]", ["news"]],
	});
	// START-12.3
	expect({ author: [columns.author, rows[0]?.author], writer: [columns.writer, rows[0]?.writer] }).toEqual({
		author: ["text", null],
		writer: ["uuid references members", null],
	});
});
