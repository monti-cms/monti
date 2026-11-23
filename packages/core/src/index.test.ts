import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	columnDefinitionsOf,
	createTestDatabase,
	recordedMigrations,
	type TestDatabase,
	tableExists,
	testServer,
} from "./__test__/database";
import { holdingAfter, overlap } from "./__test__/race";
import { initial } from "./db/migrations/0001-initial";
import type { Database, Migration } from "./db/types";
import { defineWrite } from "./engine/operation";
import {
	coreMigrations,
	type MontiConfig,
	migrate,
	migrateMonti,
	type Plugin,
	planSchemaDiff,
	type Schema,
	type SchemaSnapshot,
	snapshotOf,
	specOf,
	startMonti,
} from "./index";

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

/** `migrateMonti`로 테스트 DB를 준비한다. */
function prepare(plugins: Plugin[], prepareSchema: Schema = schema, config: Partial<MontiConfig> = {}) {
	return migrateMonti({ db, schema: prepareSchema, config: { name: "Monti Blog", plugins, ...config } });
}

/** `startMonti`로 엔진을 조립한다. */
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

/** 프로젝트의 마이그레이션 단계가 만드는 테이블. */
async function createNotes(projectDb: Kysely<unknown>): Promise<void> {
	await projectDb.schema
		.createTable("project_notes")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.execute();
}

/** 마이그레이션 CLI가 만든 파일처럼 DDL 문장들을 차례로 실행한다. */
async function runStatements(statements: string[]): Promise<void> {
	for (const statement of statements) await sql.raw(statement).execute(db);
}

it("START-1 코어와 플러그인의 내장 마이그레이션을 코어 먼저 실행한다", async () => {
	const plugin: Plugin = { name: "albums", migrations: [{ name: "photos", up: createPhotos }] };

	await prepare([plugin]);

	// START-1.1
	expect(await recordedMigrations(testDb.db)).toEqual([
		["@monti-cms/core", initial.name],
		["albums", "photos"],
	]);
	// START-1.2
	expect(await tableExists(testDb.db, "albums_photos")).toBe(true);
});

it("START-2 `monti` 객체로 코어 리소스와 플러그인 Operation을 모두 실행할 수 있다", async () => {
	const tag = defineWrite({ input: z.object({ name: z.string() }), run: tagRun });
	const plugin: Plugin = { name: "albums", operations: { albums: { tag } } };
	await prepare([plugin]);

	const monti = start([plugin]);
	const folder = await monti.folders.create({ scope: "media", name: "Photos" });
	// 플러그인 Operation은 `monti`의 타입에 없으므로 이름으로 꺼낸다.
	const albums: { tag: (input: { name: string }) => Promise<{ tag: string }> } = Reflect.get(monti, "albums");
	const output = await albums.tag({ name: "Summer" });

	// START-2.1
	expect(await db.selectFrom("folders").select(["id", "name"]).execute()).toEqual([{ id: folder.id, name: "Photos" }]);
	// START-2.2
	expect(output).toEqual({ tag: "Summer" });
});

it("START-3 스키마에 지원하지 않는 필드 종류가 들어 있으면 마이그레이션 전에 거절한다", async () => {
	const migrated = prepare([], unknownType);

	// START-3.1
	await expect(migrated).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// START-3.2
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
});

it("START-4 플러그인의 키 서비스가 `keys.check`에 연결된다", async () => {
	const check = vi.fn<(secret: string) => Promise<void>>().mockResolvedValue(undefined);
	const plugin: Plugin = { name: "mail", keyServices: [{ service: "mail", check }] };

	const monti = start([plugin]);
	await monti.keys.check({ service: "mail", secret: "mail-secret-1234" });

	// START-4.1
	expect(check).toHaveBeenCalledExactlyOnceWith("mail-secret-1234");
});

it("START-5 `monti` 객체의 명세에 코어의 모든 Operation이 들어 있다", async () => {
	const monti = start([]);

	const names = monti.spec().map((entry) => entry.name);

	// START-5.1
	expect({ names: names.sort(), withStoredKey: names.includes("withStoredKey") }).toEqual({
		names: [...coreOperations].sort(),
		withStoredKey: false,
	});
});

it("START-6 개발 서버에서 DB를 준비하면 스키마에 정의된 컬렉션 테이블도 함께 만든다", async () => {
	await prepare([], schema, { dev: true });

	// START-6.1
	expect({ posts: await tableExists(testDb.db, "posts"), data: await tableExists(testDb.db, "posts_data") }).toEqual({
		posts: true,
		data: true,
	});
});

it("START-7 운영 서버에서 DB를 준비하면 등록된 마이그레이션만 실행하고 컬렉션 테이블은 자동으로 만들지 않는다", async () => {
	await prepare([], schema, { dev: false });

	// START-7.1
	expect({
		migrations: await tableExists(testDb.db, "migrations"),
		posts: await tableExists(testDb.db, "posts"),
		data: await tableExists(testDb.db, "posts_data"),
	}).toEqual({ migrations: true, posts: false, data: false });
});

it("START-14 엔진 조립만 호출하면 개발 설정이어도 DB 테이블을 만들거나 바꾸지 않는다", async () => {
	// 돌려준 값이 `Promise`라도 끝날 때까지 기다린 뒤 DB를 본다.
	await start([], schema, { dev: true });

	// START-14.1
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
	// START-14.2
	expect(await tableExists(testDb.db, "posts")).toBe(false);
});

it("START-8 관리자·세션·키 리소스의 쓰기는 이벤트 구독자에게 통지하지 않는다", async () => {
	await prepare([]);
	const monti = startMonti({
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
	const monti = start([plugin]);

	// START-9.1
	expect(spec.map((entry) => entry.name).sort()).toEqual([...coreOperations, "albums.tag"].sort());
	// START-9.2
	expect(spec).toEqual(monti.spec());
});

it("START-10 공개 마이그레이션 실행기로 프로젝트 출처의 마이그레이션 단계를 실행할 수 있다", async () => {
	await migrate(db, "@monti-cms/core", coreMigrations);
	const step: Migration = { name: "0001-notes", up: createNotes };

	await migrate(db, "project", [step]);

	// START-10.1
	expect(await tableExists(testDb.db, "project_notes")).toBe(true);
	// START-10.2
	expect(await recordedMigrations(testDb.db)).toContainEqual(["project", step.name]);
});

it("START-13 공개된 코어 내장 마이그레이션 목록을 단일 롤백 트랜잭션으로 시험 실행하면 DB에 변경을 남기지 않는다", async () => {
	const tx = await testDb.db.startTransaction().execute();
	let foldersInside = false;
	try {
		for (const migration of coreMigrations) await migration.up(tx);
		foldersInside = await tableExists(tx, "folders");
	} finally {
		await tx.rollback().execute();
	}

	// START-13.1
	expect(foldersInside).toBe(true);
	// START-13.2
	expect({
		folders: await tableExists(testDb.db, "folders"),
		migrations: await tableExists(testDb.db, "migrations"),
	}).toEqual({ folders: false, migrations: false });
});

it("START-11 빈 스냅샷과 새 스키마의 차이를 SQL로 생성해 적용하면 개발 서버 동기화와 같은 테이블과 열이 만들어진다", async () => {
	await migrate(db, "@monti-cms/core", coreMigrations);

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
	await prepare([], beforeChange, { dev: true });
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

it("START-15 개발 서버를 동시에 두 번 띄워도 컬렉션 테이블 준비가 둘 다 성공한다", async () => {
	// 첫 준비를 `posts` 테이블을 만든 직후(커밋 전)에 멈춰 두고 두 번째 준비를 시작한다.
	const runs = await overlap(
		db,
		(hold) =>
			migrateMonti({
				db: holdingAfter(db, /^create table "posts" /, hold),
				schema,
				config: { name: "Monti Blog", dev: true },
			}),
		() => prepare([], schema, { dev: true }),
	);

	// START-15.1
	expect(runs.map((run) => run.code)).toEqual([null, null]);
	// START-15.2
	expect([await tableExists(testDb.db, "posts"), await tableExists(testDb.db, "posts_data")]).toEqual([true, true]);
});

it("START-16 이름이 같은 플러그인이 둘 이상 있으면 마이그레이션을 시작할 수 없다", async () => {
	const migrated = prepare([{ name: "albums" }, { name: "albums" }]);

	// START-16.1
	await expect(migrated).rejects.toMatchObject({ code: "CONFLICT" });
	// START-16.2
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
});

it("START-17 예약된 출처 이름의 플러그인으로는 마이그레이션을 시작할 수 없다", async () => {
	const codes: unknown[] = [];
	for (const name of ["@monti-cms/core", "project"]) {
		codes.push(await prepare([{ name }]).catch((error: { code: string }) => error.code));
	}

	// START-17.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST"]);
	// START-17.2
	expect(await tableExists(testDb.db, "migrations")).toBe(false);
});

it("START-18 허용되지 않은 식별자가 들어 있는 이전 스냅샷으로는 스키마 변경 SQL을 만들 수 없다", () => {
	const column = (name: string) => ({ data: [{ name, type: "text" }], rels: [] });
	const snapshots: SchemaSnapshot[] = [
		{ collections: { 'po"sts': column("title") } },
		{ collections: { "po.sts": column("title") } },
		{ collections: { "": column("title") } },
		{ collections: { ["c".repeat(64)]: column("title") } },
		{ collections: { ["c".repeat(59)]: column("title") } },
		{ collections: { admin: column("title") } },
		{ collections: { notes_data: column("title") } },
		{ collections: { notes_rels: column("title") } },
		{ collections: { posts: column('ti"tle') } },
		{ collections: { posts: column("ti.tle") } },
		{ collections: { posts: column("") } },
		{ collections: { posts: column("가".repeat(22)) } },
	];

	const codes = snapshots.map((prev) => {
		try {
			planSchemaDiff(prev, schema);
			return null;
		} catch (error) {
			return (error as { code: string }).code;
		}
	});

	// START-18.1
	expect(codes).toEqual(snapshots.map(() => "BAD_REQUEST"));
});

/** `search_path`가 `app` 스키마인 연결로 같은 테스트 DB를 여는 Kysely. */
async function appSchemaDb(): Promise<Kysely<Database>> {
	await sql`create schema app`.execute(db);
	const { rows } = await sql<{ name: string }>`select current_database() as name`.execute(db);
	const pool = new pg.Pool({ ...testServer(rows[0]?.name), options: "-c search_path=app", max: 2 });
	return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

it("START-19 기본 DB 스키마가 `public`이 아니면 개발 서버 동기화는 그 스키마의 테이블만 바꾼다", async () => {
	const config = { name: "Monti Blog", dev: true };
	const withHeadline: Schema = {
		locales: ["ko"],
		collections: { posts: { fields: { headline: { type: "text" } } } },
	};
	await migrateMonti({ db, schema: withHeadline, config });
	const publicColumns = await columnDefinitionsOf(testDb.db, "posts_data");
	const appDb = await appSchemaDb();
	const withSummary: Schema = {
		locales: ["ko"],
		collections: { posts: { fields: { title: { type: "text" }, summary: { type: "text" } } } },
	};
	try {
		await migrateMonti({ db: appDb, schema, config });

		await migrateMonti({ db: appDb, schema: withSummary, config });
	} finally {
		await appDb.destroy();
	}
	const { rows } = await sql<{ name: string }>`
		select column_name as name from information_schema.columns
		where table_schema = 'app' and table_name = 'posts_data' and column_name = 'summary'
	`.execute(db);

	// START-19.1
	expect(rows).toEqual([{ name: "summary" }]);
	// START-19.2
	expect(await columnDefinitionsOf(testDb.db, "posts_data")).toEqual(publicColumns);
});

it("START-23 플러그인의 이벤트 구독에는 저장된 키의 원문을 읽는 기능이 제공되지 않는다", async () => {
	await prepare([]);
	const received = Promise.withResolvers<object>();
	const plugin: Plugin = {
		name: "watcher",
		onEvent(_event, ctx) {
			received.resolve(ctx.monti);
		},
	};
	const monti = startMonti({
		db,
		schema,
		config: { name: "Monti Blog", plugins: [plugin] },
		schemaFile,
		configFile,
		secret: "test monti secret",
	});

	const created = await monti.folders.create({ scope: "posts", name: "Drafts" }).then(
		() => true,
		() => false,
	);
	// 이벤트는 커밋 뒤 따로 통지된다: 2초 안에 오지 않으면 호출되지 않은 것으로 본다.
	const pluginMonti = await Promise.race([
		received.promise,
		new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
	]);

	// START-23.1
	expect({ created, called: pluginMonti !== null }).toEqual({ created: true, called: true });
	// START-23.2
	expect(pluginMonti === null ? null : "withStoredKey" in pluginMonti).toBe(false);
});

/** 암호화 비밀값으로 `startMonti`를 한 `monti`. `null`을 주면 암호화 비밀값이 없다. */
async function keyMonti(secret: string | null = "test monti secret") {
	await prepare([]);
	return startMonti({
		db,
		schema,
		config: { name: "Monti Blog" },
		schemaFile,
		configFile,
		secret: secret ?? undefined,
	});
}

const mailKey = { service: "mail", name: "Mail", secret: "mail-secret-1234" };

it("KEY-USE-1 서버 코드가 저장된 키의 원문을 받아 쓰고 그 결과를 돌려받는다", async () => {
	const monti = await keyMonti();
	const { id } = await monti.keys.create(mailKey);
	const use = vi.fn<(apiKey: string) => Promise<string>>().mockResolvedValue("모델 목록");

	const output = await monti.withStoredKey({ id, service: mailKey.service }, use);

	// KEY-USE-1.1
	expect(use.mock.calls).toEqual([[mailKey.secret]]);
	// KEY-USE-1.2
	expect(output).toBe("모델 목록");
});

it("KEY-USE-2 암호화 비밀값이 없으면 저장된 키를 받아 쓸 수 없다", async () => {
	const { id } = await (await keyMonti()).keys.create(mailKey);
	const use = vi.fn<(apiKey: string) => Promise<string>>().mockResolvedValue("모델 목록");

	const used = (await keyMonti(null)).withStoredKey({ id, service: mailKey.service }, use);

	// KEY-USE-2.1
	await expect(used).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// KEY-USE-2.2
	expect(use).not.toHaveBeenCalled();
});

it("KEY-USE-3 존재하지 않는 키는 받아 쓸 수 없다", async () => {
	const use = vi.fn<(apiKey: string) => Promise<string>>().mockResolvedValue("모델 목록");

	const used = (await keyMonti()).withStoredKey({ id: "no-such-key", service: mailKey.service }, use);

	// KEY-USE-3.1
	await expect(used).rejects.toMatchObject({ code: "NOT_FOUND" });
	// KEY-USE-3.2
	expect(use).not.toHaveBeenCalled();
});

it("KEY-USE-4 다른 서비스의 키로 저장된 키는 받아 쓸 수 없다", async () => {
	const monti = await keyMonti();
	const { id } = await monti.keys.create(mailKey);
	const use = vi.fn<(apiKey: string) => Promise<string>>().mockResolvedValue("모델 목록");

	const used = monti.withStoredKey({ id, service: "storage" }, use);

	// KEY-USE-4.1
	await expect(used).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// KEY-USE-4.2
	expect(use).not.toHaveBeenCalled();
});
