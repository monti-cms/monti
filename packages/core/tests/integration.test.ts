import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Kysely, sql } from "kysely";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTestDatabase } from "../src/__test__/database";
import {
	type Database,
	defineRead,
	defineWrite,
	type Migration,
	type Monti,
	type MontiConfig,
	MontiError,
	type MontiEvent,
	migrate,
	migrateMonti,
	type Plugin,
	planSchemaDiff,
	type ReadContext,
	removeLooseFiles,
	type Schema,
	type StorageAdapter,
	snapshotOf,
	startMonti,
	type WriteContext,
} from "../src/index";

// 공통 준비: 테스트마다 새 DB와 임시 폴더를 만들어 `migrateMonti`로 DB를 준비하고 `startMonti`로 코어 리소스 전체를 올리고,
// 끝나면 모두 지운다.

type CoreMonti = ReturnType<typeof startMonti>;

/** `dryRun` 콜백이 받는 쓰기 전용 호출. `transaction` 콜백이 받는 호출도 이 쓰기들을 모두 가진다. */
type WriteClient = Parameters<Parameters<CoreMonti["dryRun"]>[0]>[0];

/** `entries`가 돌려주는 글 한 건. */
type Entry = Awaited<ReturnType<CoreMonti["entries"]["get"]>>;

/** `startMonti`로 올린 코어와 그 DB, 그리고 앱이 스키마·설정을 불러온 두 파일. */
interface Stack {
	db: Kysely<Database>;
	monti: CoreMonti;
	schemaFile: string;
	configFile: string;
}

const SITE = "Monti 통합 시나리오";
const SECRET = "integration master secret";
const HOUR_MS = 60 * 60 * 1000;
/** DB를 만들고 수십 번 오가는 시나리오라 기본 5초보다 넉넉히 둔다. */
const SCENARIO = { timeout: 60_000 };

/** 테스트가 만든 DB와 임시 폴더를 지우는 일들: `afterEach`가 성공·실패와 관계없이 모두 실행한다. */
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
	vi.useRealTimers();
	await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

/** 앱이 불러오는 `monti.schema.ts`의 내용. */
function schemaText(schema: Schema): string {
	return `export default ${JSON.stringify(schema)};\n`;
}

/** `monti.schema.ts`의 글자에 들어 있는 스키마. */
function schemaOfText(text: string): unknown {
	return JSON.parse(text.replace(/^export default /, "").replace(/;\s*$/, ""));
}

/** `monti.schema.ts`에 지금 들어 있는 스키마. */
async function schemaInFile(file: string): Promise<unknown> {
	return schemaOfText(await readFile(file, "utf8"));
}

/** 이 테스트만 쓰는 임시 폴더에 `monti.schema.ts`와 `monti.config.ts`를 둔다. */
async function newFiles(schema: Schema): Promise<Pick<Stack, "schemaFile" | "configFile">> {
	const dir = await mkdtemp(path.join(tmpdir(), "monti-integration-"));
	cleanups.push(() => rm(dir, { recursive: true, force: true }));
	const schemaFile = path.join(dir, "monti.schema.ts");
	const configFile = path.join(dir, "monti.config.ts");
	await writeFile(schemaFile, schemaText(schema));
	await writeFile(configFile, `export default { name: ${JSON.stringify(SITE)} };\n`);
	return { schemaFile, configFile };
}

/** 이 테스트만 쓰는 빈 DB를 실제 앱처럼 `migrateMonti`로 준비한 뒤 `startMonti`로 코어 리소스 전체를 올린다. */
async function boot(schema: Schema, config: Omit<MontiConfig, "name">, secret?: string): Promise<Stack> {
	const testDb = await createTestDatabase();
	cleanups.push(testDb.drop);
	const db = testDb.db as Kysely<Database>;
	const files = await newFiles(schema);
	const options = { db, schema, config: { name: SITE, ...config } };
	await migrateMonti(options);
	const monti = startMonti({ ...options, ...files, secret });
	return { db, monti, ...files };
}

/** `public` 스키마에 테이블이 있는지. */
async function tableExists(db: Kysely<Database>, table: string): Promise<boolean> {
	const { rows } = await sql<{ name: string | null }>`select to_regclass(${`public.${table}`})::text as name`.execute(
		db,
	);
	return typeof rows[0]?.name === "string";
}

/** 테이블의 행 수. */
async function countRows(db: Kysely<Database>, table: string): Promise<number> {
	const { rows } = await sql<{ count: number }>`select count(*)::int as count from ${sql.table(table)}`.execute(db);
	return rows[0]?.count ?? 0;
}

/** 테이블의 열마다 `이름 타입`, 정렬해서. 테이블이 없으면 빈 배열. */
async function columnsOf(db: Kysely<Database>, table: string): Promise<string[]> {
	const { rows } = await sql<{ definition: string }>`
		select attname || ' ' || format_type(atttypid, atttypmod) as definition from pg_attribute
		where attrelid = to_regclass(${`public.${table}`}) and attnum > 0 and not attisdropped
	`.execute(db);
	return rows.map((row) => row.definition).sort();
}

// 시나리오 1: 폴더 · 미디어 · 템플릿 · 다국어 글 · 번역 상태 · 발행 · 휴지통 · 복구 · 임시 파일 정리

/** 메모리 저장소: 업로드가 끝난 파일을 `files`에 두고, `remove`한 키를 부른 순서대로 `removed`에 남긴다. */
interface RecordingStorage extends StorageAdapter {
	files: Map<string, { mime: string; size: number }>;
	removed: string[];
}

function recordingStorage(): RecordingStorage {
	const files = new Map<string, { mime: string; size: number }>();
	const removed: string[] = [];
	return {
		files,
		removed,
		ticket: async (key, info) => ({ url: `memory://upload/${key}`, headers: { "content-type": info.mime } }),
		stat: async (key) => files.get(key) ?? null,
		url: (key) => `memory://${key}`,
		remove: async (key) => {
			removed.push(key);
			files.delete(key);
		},
	};
}

interface Cms extends Stack {
	storage: RecordingStorage;
}

/** 다국어 블로그: `posts`는 본문, 단건 미디어, `authors`를 가리키는 단건·다건 관계, 조건부 필드를 가진다. */
const CMS_SCHEMA: Schema = {
	locales: ["ko", "en"],
	collections: {
		authors: { fields: { name: { type: "text", required: true } } },
		posts: {
			body: true,
			fields: {
				title: { type: "text", required: true },
				cover: { type: "media" },
				author: { type: "relation", to: "authors" },
				contributors: { type: "relation", to: "authors", many: true },
				layout: {
					type: "conditional",
					options: {
						hero: { fields: { caption: { type: "text" } } },
						plain: { fields: { note: { type: "text" } } },
					},
				},
			},
		},
	},
};

const TITLE = "몬티를 소개합니다";
const EDITED_TITLE = "몬티를 다시 소개합니다";
const CAPTION = "표지 설명";

/** 글이 가리키는 표지 미디어와 작가들. */
interface PostRefs {
	cover: string;
	author: string;
	contributors: string[];
}

/** 글의 필드 값 전체: 제목과 조건부 필드의 설명만 언어마다 다르다. */
function postFields(refs: PostRefs, title: string, caption: string) {
	const { cover, author, contributors } = refs;
	return { title, cover, author, contributors, layout: { option: "hero", fields: { caption } } };
}

/** 이미지 블록과 링크가 걸린 문단으로 된 본문. 블록 `id`는 `prefix` 뒤에 1, 2를 붙인다. */
function bodyOf(prefix: string, mediaId: string, text: string) {
	const link = { type: "link", href: "https://monti.example/guide" };
	return {
		blocks: [
			{ id: `${prefix}1`, type: "image", attrs: { mediaId } },
			{ id: `${prefix}2`, type: "paragraph", content: [{ type: "text", text, marks: [link] }] },
		],
	};
}

/** 미디어 한 건: 업로드 표를 받고, 저장소에 파일을 올린 뒤, 미디어로 등록한다. */
async function upload(cms: Cms, filename: string, folderId: string) {
	const ticket = await cms.monti.media.startUpload({ mime_type: "image/png", size: 2048 });
	cms.storage.files.set(ticket.key, { mime: "image/png", size: 2048 });
	return cms.monti.media.create({ key: ticket.key, folder_id: folderId, filename, width: 1200, height: 630 });
}

/** 글·미디어 폴더, 파일만 올리고 미디어로 등록하지 않은 업로드 하나, 미디어 둘(표지와 본문 이미지), 본문 이미지를 쓰는 템플릿을 만든다. */
async function prepareLibrary(cms: Cms) {
	const postFolder = await cms.monti.folders.create({ scope: "posts", name: "공지" });
	const mediaFolder = await cms.monti.folders.create({ scope: "media", name: "이미지" });
	const abandoned = await cms.monti.media.startUpload({ mime_type: "image/png", size: 512 });
	cms.storage.files.set(abandoned.key, { mime: "image/png", size: 512 });
	const cover = await upload(cms, "cover.png", mediaFolder.id);
	const inline = await upload(cms, "inline.png", mediaFolder.id);
	expect(cover).toMatchObject({ folder_id: mediaFolder.id, mime_type: "image/png", url: `memory://${cover.key}` });
	const content = bodyOf("t", inline.id, "템플릿 문단");
	const template = await cms.monti.templates.create({ collection: "posts", name: "기본 글", content });
	expect(template).toMatchObject({ collection: "posts", name: "기본 글", content });
	return { postFolder, cover, inline, template, abandonedKey: abandoned.key };
}

type Library = Awaited<ReturnType<typeof prepareLibrary>>;

/** 발행된 작가 글의 `id`. */
async function publishedAuthor(cms: Cms, slug: string, name: string): Promise<string> {
	const author = await cms.monti.entries.create({ collection: "authors", locale: "ko", slug, fields: { name } });
	await cms.monti.entries.publish({ id: author.id });
	return author.id;
}

/** 작가 둘을 발행하고, 폴더·표지·작가·참여 작가·조건부 필드·본문(이미지와 링크)을 모두 채운 한국어 글을 만든다. */
async function writePost(cms: Cms, library: Library) {
	const kim = await publishedAuthor(cms, "kim", "김작가");
	const lee = await publishedAuthor(cms, "lee", "이작가");
	const refs = { cover: library.cover.id, author: kim, contributors: [kim, lee] };
	const fields = postFields(refs, TITLE, CAPTION);
	const body = bodyOf("b", library.inline.id, "자세히 보기");
	const folder_id = library.postFolder.id;
	const post = await cms.monti.entries.create({
		collection: "posts",
		locale: "ko",
		slug: "hello",
		folder_id,
		fields,
		body,
	});
	expect(post).toMatchObject({ source_locale: "ko", folder_id, slug: "hello", fields, body, published_at: null });
	const { uses } = await cms.monti.media.get({ id: library.inline.id });
	expect(uses).toEqual(
		expect.arrayContaining([
			{ source_kind: "template", source_id: library.template.id, field_path: "content" },
			{ source_kind: "entry", source_id: post.id, field_path: "body" },
		]),
	);
	return { id: post.id, refs, inlineId: library.inline.id };
}

type Post = Awaited<ReturnType<typeof writePost>>;

/** `translationStatus.list`가 돌려주는 `en` 번역 한 줄. */
function enStatus(id: string, outdated_count: number, unseen_count: number) {
	return { id, collection: "posts", locale: "en", source_locale: "ko", outdated_count, unseen_count };
}

const ALL_FIELDS = { title: true, cover: true, author: true, contributors: true, layout: true } as const;

/** `en`을 더하면 원문 전체가 미확인이고, 번역을 저장한 뒤 원문 필드·블록을 모두 확인하면 최신이 된다. */
async function translatePost(cms: Cms, post: Post) {
	const { id } = post;
	await cms.monti.entries.addLocale({ id, locale: "en" });
	// 원문 필드 5개와 본문 블록 2개를 아직 아무도 확인하지 않았다.
	expect(await cms.monti.translationStatus.list({ id })).toEqual([enStatus(id, 0, 7)]);
	const fields = postFields(post.refs, "Introducing Monti", "Cover caption");
	await cms.monti.entries.update({ id, locale: "en", fields, body: bodyOf("e", post.inlineId, "Read more") });
	const blocks = { b1: { link: "e1" }, b2: { link: "e2" } };
	const status = await cms.monti.translationStatus.update({ id, locale: "en", fields: ALL_FIELDS, blocks });
	const statuses = [...Object.values(status.fields), ...status.blocks].map((unit) => unit.status);
	expect(statuses).toEqual(Array.from({ length: 7 }, () => "seen"));
	expect(await cms.monti.translationStatus.list({ id })).toEqual([enStatus(id, 0, 0)]);
}

/** 원문 제목을 고치면 `en`의 제목만 원문 변경(stale) 상태가 되고, 다시 확인하면 최신으로 돌아온다. */
async function editSourceTitle(cms: Cms, post: Post) {
	const { id } = post;
	await cms.monti.entries.update({ id, fields: postFields(post.refs, EDITED_TITLE, CAPTION) });
	const status = await cms.monti.translationStatus.get({ id, locale: "en" });
	expect(status.fields.title).toEqual({ status: "outdated", seen_value: TITLE });
	expect(await cms.monti.translationStatus.list({ id })).toEqual([enStatus(id, 1, 0)]);
	await cms.monti.translationStatus.update({ id, locale: "en", fields: { title: true } });
	expect(await cms.monti.translationStatus.list({ id })).toEqual([enStatus(id, 0, 0)]);
}

/** 원문과 번역본을 발행하면 언어마다 발행본이 생긴다. */
async function publishBoth(cms: Cms, post: Post) {
	const ko = await cms.monti.entries.publish({ id: post.id });
	const en = await cms.monti.entries.publish({ id: post.id, locale: "en" });
	expect(ko).toMatchObject({ locale: "ko", slug: "hello", fields: postFields(post.refs, EDITED_TITLE, CAPTION) });
	expect(en).toMatchObject({ locale: "en", slug: "hello", fields: { title: "Introducing Monti" } });
	expect(ko.published_at).toBeInstanceOf(Date);
	expect(await cms.monti.entries.list({ collection: "posts", locale: "en" })).toEqual([en]);
}

/**
 * 발행본이 쓰는 표지를 휴지통에 넣으면 발행본에서만 비고 발행이 막히며, 되살리면 다시 발행하기 전부터 기존 발행본에 표지가
 * 돌아오고 다시 발행할 수 있다.
 */
async function trashAndRestoreCover(cms: Cms, post: Post) {
	const { id, refs } = post;
	const fields = postFields(refs, EDITED_TITLE, CAPTION);
	await cms.monti.trash.move({ id: refs.cover });
	expect((await cms.monti.entries.get({ id, status: "published" })).fields).toEqual({ ...fields, cover: undefined });
	expect((await cms.monti.entries.get({ id, status: "draft" })).fields).toEqual(fields);
	await expect(cms.monti.entries.publish({ id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await cms.monti.trash.restore({ id: refs.cover });
	expect((await cms.monti.entries.get({ id, status: "published" })).fields).toEqual(fields);
	expect((await cms.monti.entries.publish({ id })).fields).toEqual(fields);
}

/** 정리 대기열(`loose_files`)의 키들, 정렬해서. */
async function looseKeys(db: Kysely<Database>): Promise<string[]> {
	const rows = await db.selectFrom("loose_files").select("key").execute();
	return rows.map((row) => row.key).sort();
}

/** 템플릿을 지우고 글·미디어를 휴지통에 넣은 뒤 영구 삭제하면, 미디어의 파일 키만 정리 대기열에 남는다. */
async function purgeAll(cms: Cms, library: Library, post: Post) {
	await cms.monti.templates.delete({ id: library.template.id });
	const trashed = [post.id, library.cover.id, library.inline.id];
	for (const id of trashed) await cms.monti.trash.move({ id });
	expect((await cms.monti.trash.list()).map((item) => item.id).sort()).toEqual([...trashed].sort());
	await cms.monti.trash.delete({ all: true });
	expect({
		trash: await cms.monti.trash.list(),
		posts: await countRows(cms.db, "posts"),
		media: await countRows(cms.db, "media"),
		uses: await countRows(cms.db, "media_uses"),
	}).toEqual({ trash: [], posts: 0, media: 0, uses: 0 });
	expect(await looseKeys(cms.db)).toEqual([library.cover.key, library.inline.key, library.abandonedKey].sort());
}

/** 영구 삭제한 미디어의 파일은 바로, 등록하지 않은 업로드의 파일은 24시간이 지난 뒤에 저장소와 대기열에서 지운다. */
async function sweepLooseFiles(cms: Cms, library: Library) {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(Date.now() + HOUR_MS);
	await removeLooseFiles({ db: cms.db, storage: cms.storage });
	expect([...cms.storage.removed].sort()).toEqual([library.cover.key, library.inline.key].sort());
	// 1시간 뒤: 등록하지 않은 업로드의 파일만 저장소에 남는다.
	expect([...cms.storage.files.keys()]).toEqual([library.abandonedKey]);
	expect(await looseKeys(cms.db)).toEqual([library.abandonedKey]);
	vi.setSystemTime(Date.now() + 24 * HOUR_MS);
	await removeLooseFiles({ db: cms.db, storage: cms.storage });
	expect(cms.storage.removed.slice(2)).toEqual([library.abandonedKey]);
	expect([...cms.storage.files.keys()]).toEqual([]);
	expect(await looseKeys(cms.db)).toEqual([]);
	vi.useRealTimers();
}

it(
	"시나리오 1: 폴더·미디어·템플릿·다국어 글을 만들어 번역하고 발행한 뒤, 휴지통·복구·영구 삭제를 거쳐 남은 파일까지 정리한다",
	SCENARIO,
	async () => {
		const storage = recordingStorage();
		const cms: Cms = { ...(await boot(CMS_SCHEMA, { dev: true, storage })), storage };
		const library = await prepareLibrary(cms);
		const post = await writePost(cms, library);
		await translatePost(cms, post);
		await editSourceTitle(cms, post);
		await publishBoth(cms, post);
		await trashAndRestoreCover(cms, post);
		await purgeAll(cms, library, post);
		await sweepLooseFiles(cms, library);
	},
);

// 시나리오 2: 개발 서버에서 바꾼 스키마를 같은 규칙의 SQL로 운영 서버(`dev: false`)에 옮긴다

/** 관계 대상이 되는 두 컬렉션: 스키마를 바꿔도 그대로다. */
const PEOPLE: Schema["collections"] = {
	authors: { fields: { name: { type: "text" } } },
	members: { fields: { name: { type: "text" } } },
};

const CATEGORY = { type: "select" as const, options: ["news", "tech"] };

/** 바꾸기 전: 지울 `legacy`, 그리고 숫자 `code`·단건 `category`·`authors`를 가리키는 다건 `contributors`를 가진 `posts`. */
const BEFORE: Schema = {
	locales: ["ko"],
	collections: {
		...PEOPLE,
		legacy: { fields: { note: { type: "text" } } },
		posts: {
			fields: {
				title: { type: "text", required: true },
				code: { type: "number" },
				category: CATEGORY,
				contributors: { type: "relation", to: "authors", many: true },
			},
		},
	},
};

/** 바꾼 뒤: `legacy`가 없고, `code`는 글자, `category`는 다건, `contributors`는 `members`를 가리키며 `new_col`이 생긴다. */
const AFTER: Schema = {
	locales: ["ko"],
	collections: {
		...PEOPLE,
		posts: {
			fields: {
				title: { type: "text", required: true },
				code: { type: "text" },
				category: { ...CATEGORY, many: true },
				contributors: { type: "relation", to: "members", many: true },
				new_col: { type: "text" },
			},
		},
	},
};

const EMPTY: Schema = { locales: ["ko"], collections: {} };

/**
 * 바꾸기 전 스키마로 작가·회원·`legacy` 글과, 작가를 가리키는 `posts` 글을 저장하고 발행한다: 그 글은 초안과 발행본이 모두
 * 있다. 개발 서버와 운영 서버에 같은 글을 넣는다.
 */
async function seedBeforeChange(stack: Stack) {
	const { entries } = stack.monti;
	const author = await entries.create({
		collection: "authors",
		locale: "ko",
		slug: "author",
		fields: { name: "작가" },
	});
	const member = await entries.create({
		collection: "members",
		locale: "ko",
		slug: "member",
		fields: { name: "회원" },
	});
	await entries.create({ collection: "legacy", locale: "ko", fields: { note: "지울 컬렉션의 글" } });
	const fields = { title: "스키마 진화", code: 42, category: "news", contributors: [author.id] };
	const post = await entries.create({ collection: "posts", locale: "ko", slug: "evolve", fields });
	return { published: await entries.publish({ id: post.id }), memberId: member.id };
}

type Seeded = Awaited<ReturnType<typeof seedBeforeChange>>;

/** 스키마를 바꾼 직후 그 글의 필드: `code`는 글자, `category`는 1개짜리 목록이 되고, 대상이 바뀐 `contributors`는 빈다. */
const CONVERTED = { title: "스키마 진화", code: "42", category: ["news"] };

/** 스키마를 바꾸면 기존 값이 새 열 타입으로 옮겨지고 대상이 바뀐 관계는 비며, 그 글을 고쳐 다시 발행할 수 있다. */
async function evolveOnDev(dev: Stack, seeded: Seeded) {
	const { id } = seeded.published;
	const { memberId } = seeded;
	expect(await dev.monti.schema.update(AFTER)).toEqual(AFTER);
	const draft = await dev.monti.entries.get({ id, status: "draft" });
	expect(draft.fields).toEqual(CONVERTED);
	const fields = {
		title: "스키마 진화",
		code: "A-42",
		category: ["news", "tech"],
		contributors: [memberId],
		new_col: "새 열",
	};
	await dev.monti.entries.update({ id, fields });
	expect((await dev.monti.entries.publish({ id })).fields).toEqual(fields);
	expect(await schemaInFile(dev.schemaFile)).toEqual(AFTER);
	expect(await tableExists(dev.db, "legacy")).toBe(false);
}

/** 마이그레이션 단계: 마이그레이션 CLI가 만드는 파일처럼 미리 뽑아 둔 SQL 문장을 차례로 실행한다. */
function runStatements(statements: string[]): Migration["up"] {
	return async (db) => {
		for (const statement of statements) await sql.raw(statement).execute(db);
	};
}

/** 프로젝트 마이그레이션 두 단계: 빈 스키마 → 바꾸기 전, 바꾸기 전 → 바꾼 뒤를 개발 서버와 같은 규칙(`planSchemaDiff`)으로 뽑은 SQL. */
function projectMigrations(): Migration[] {
	return [
		{ name: "0001-collections", up: runStatements(planSchemaDiff(snapshotOf(EMPTY), BEFORE)) },
		{ name: "0002-evolve-posts", up: runStatements(planSchemaDiff(snapshotOf(BEFORE), AFTER)) },
	];
}

/** 비어 있는 운영 DB에서 바꾸기 전 스키마로 운영 서버를 시작하고, 첫 프로젝트 마이그레이션만 적용한다. */
async function bootProduction(): Promise<Stack> {
	const prod = await boot(BEFORE, { dev: false });
	// 운영 서버는 스키마를 보고 컬렉션 테이블을 스스로 만들지 않는다.
	expect(await tableExists(prod.db, "posts")).toBe(false);
	await migrate(prod.db, "project", projectMigrations().slice(0, 1));
	return prod;
}

/**
 * 새 코드를 배포하듯 프로젝트 마이그레이션 전체를 다시 넘겨 바꾼 스키마의 단계만 적용하고(이미 적용한 단계는 건너뛴다), 같은
 * DB에서 바꾼 스키마 파일을 불러 `migrateMonti`로 DB를 준비한 뒤 운영 서버를 다시 시작한다.
 */
async function evolveProduction(old: Stack): Promise<Stack> {
	await migrate(old.db, "project", projectMigrations());
	await writeFile(old.schemaFile, schemaText(AFTER));
	const { db, schemaFile, configFile } = old;
	const options = { db, schema: AFTER, config: { name: SITE, dev: false } };
	await migrateMonti(options);
	const monti = startMonti({ ...options, schemaFile, configFile });
	return { ...old, monti };
}

/** 마이그레이션 직후 기존 글: 초안과 발행본이 개발 서버와 같은 값으로 바뀌고, 발행본은 발행 시각·슬러그와 함께 남는다. */
async function expectExistingConverted(prod: Stack, existing: Entry): Promise<Entry> {
	const { id } = existing;
	expect((await prod.monti.entries.get({ id, status: "draft" })).fields).toEqual(CONVERTED);
	const published = await prod.monti.entries.get({ id, status: "published" });
	expect(published).toEqual({ ...existing, fields: CONVERTED });
	return published;
}

/** 운영 서버는 기존 회원을 가리키는 글을 만들고 발행하고 기존 글과 함께 읽지만, 스키마와 설정은 바꾸지 않는다. */
async function useProduction(prod: Stack, memberId: string, existing: Entry) {
	const { entries } = prod.monti;
	const fields = {
		title: "운영 새 글",
		code: "P-1",
		category: ["tech"],
		contributors: [memberId],
		new_col: "운영 값",
	};
	const post = await entries.create({ collection: "posts", locale: "ko", slug: "launch", fields });
	const published = await entries.publish({ id: post.id });
	expect(published.fields).toEqual(fields);
	// `entries.list`는 순서를 정하지 않는다.
	const listed = await entries.list({ collection: "posts" });
	expect(listed).toHaveLength(2);
	expect(listed).toEqual(expect.arrayContaining([existing, published]));
	await expect(prod.monti.schema.update(BEFORE)).rejects.toMatchObject({ code: "FORBIDDEN" });
	await expect(prod.monti.config.update({ name: "운영에서 바꾼 이름" })).rejects.toMatchObject({ code: "FORBIDDEN" });
}

/** `posts`의 컬렉션 테이블 모양과 `legacy` 테이블이 남았는지. */
async function collectionTables(db: Kysely<Database>) {
	return {
		posts_data: await columnsOf(db, "posts_data"),
		posts_rels: await columnsOf(db, "posts_rels"),
		legacy: await tableExists(db, "legacy"),
	};
}

it(
	"시나리오 2: 개발 서버에서 바꾼 스키마를 같은 SQL로 운영 DB에 옮기면 기존 글이 같은 규칙으로 바뀌어 남고, 운영 서버는 글을 쓰되 스키마·설정 변경은 막는다",
	SCENARIO,
	async () => {
		const dev = await boot(BEFORE, { dev: true });
		await evolveOnDev(dev, await seedBeforeChange(dev));
		const old = await bootProduction();
		const seeded = await seedBeforeChange(old);
		const prod = await evolveProduction(old);
		const existing = await expectExistingConverted(prod, seeded.published);
		await useProduction(prod, seeded.memberId, existing);
		const devTables = await collectionTables(dev.db);
		expect(devTables.posts_data).toEqual(expect.arrayContaining(["category text[]", "code text", "new_col text"]));
		expect(devTables.posts_rels).toEqual(expect.arrayContaining(["members_id uuid"]));
		// 개발 서버의 동기화와 운영 서버의 마이그레이션이 같은 테이블을 만든다.
		expect(await collectionTables(prod.db)).toEqual(devTables);
	},
);

// 시나리오 3: 복합 `transaction` · `dryRun`의 원자성과 `onEvent`의 순서 · 격리

const BLOG: Schema = { locales: ["ko"], collections: { posts: { fields: { title: { type: "text" } } } } };
const BLOG_WITH_NOTES: Schema = {
	locales: ["ko"],
	collections: { ...BLOG.collections, notes: { fields: { memo: { type: "text" } } } },
};
const ROLLBACK = "묶음의 끝에서 실패";

/** 구독자가 통지를 받은 그 순간에 본 것: 이벤트, 스키마 파일의 글자 그대로, 그 순간 부른 `schema.get`의 스키마. */
interface Notice {
	event: MontiEvent;
	file: string;
	schema: Promise<Schema>;
}

/** 실패하는 구독자 둘(동기·비동기)을 먼저 달고, 받은 이벤트를 그 순간의 스키마 파일·스키마와 함께 차례로 기록하는 구독자를 단다. */
function recordEvents(stack: Stack): Notice[] {
	const notices: Notice[] = [];
	stack.monti.onEvent(() => {
		throw new Error("구독자 오류");
	});
	stack.monti.onEvent(() => Promise.reject(new Error("구독자 비동기 오류")));
	stack.monti.onEvent((event) => {
		// 통지를 받은 그 순간을 남기려고 파일은 동기로 읽고, `schema.get`은 기다리지 않고 부른다: 읽기는 부른 순간의 스키마를 본다.
		notices.push({ event, file: readFileSync(stack.schemaFile, "utf8"), schema: stack.monti.schema.get() });
	});
	return notices;
}

/** 폴더 만들기, 그 폴더에 글 만들기, 발행, `notes` 컬렉션을 더하는 스키마 변경을 한 묶음으로 실행한다. */
async function writeBundle(tx: WriteClient) {
	const folder = await tx.folders.create({ scope: "posts", name: "묶음" });
	const fields = { title: "한 묶음의 글" };
	const entry = await tx.entries.create({
		collection: "posts",
		locale: "ko",
		slug: "bundle",
		folder_id: folder.id,
		fields,
	});
	const published = await tx.entries.publish({ id: entry.id });
	const schema = await tx.schema.update(BLOG_WITH_NOTES);
	return { folder, entry, published, schema };
}

async function failingBundle(tx: WriteClient): Promise<never> {
	await writeBundle(tx);
	throw new Error(ROLLBACK);
}

/** DB의 폴더·글 수와 `notes` 테이블, 엔진이 보는 스키마, 스키마 파일의 글자 그대로. */
async function stateOf(stack: Stack) {
	return {
		folders: await countRows(stack.db, "folders"),
		posts: await countRows(stack.db, "posts"),
		notes: await tableExists(stack.db, "notes"),
		schema: await stack.monti.schema.get(),
		file: await readFile(stack.schemaFile, "utf8"),
	};
}

/** 처음 그대로: 폴더·글·`notes` 테이블이 없고, 스키마와 파일이 시작할 때의 것이다. */
const UNTOUCHED = { folders: 0, posts: 0, notes: false, schema: BLOG, file: schemaText(BLOG) };

/** 묶음의 끝에서 오류가 나면 DB·스키마·파일이 모두 처음 그대로이고 아무 이벤트도 통지되지 않는다. */
async function expectRolledBack(stack: Stack, notices: Notice[]) {
	await expect(stack.monti.transaction(failingBundle)).rejects.toThrow(ROLLBACK);
	expect(await stateOf(stack)).toEqual(UNTOUCHED);
	expect(notices).toEqual([]);
}

/** 시험 실행은 결과를 실제처럼 돌려주지만 DB·스키마·파일에 아무것도 남기지 않고 아무 이벤트도 통지하지 않는다. */
async function expectDryRun(stack: Stack, notices: Notice[]) {
	const tried = await stack.monti.dryRun(writeBundle);
	expect(tried).toMatchObject({ folder: { name: "묶음" }, entry: { slug: "bundle" }, schema: BLOG_WITH_NOTES });
	expect(tried.published.published_at).toBeInstanceOf(Date);
	expect(await stateOf(stack)).toEqual(UNTOUCHED);
	expect(notices).toEqual([]);
}

/**
 * 커밋된 묶음은 DB·스키마·파일에 남고, 이벤트가 호출 순서대로 한 번씩 통지된다: 앞선 구독자의 실패는 영향이 없다. 첫 통지를
 * 받는 순간부터 스키마 파일과 엔진의 스키마가 이미 바뀌어 있다: 커밋하고 파일에 반영한 뒤에 통지한다.
 */
async function expectCommitted(stack: Stack, notices: Notice[]) {
	const done = await stack.monti.transaction(writeBundle);
	const schema = BLOG_WITH_NOTES;
	expect(await stateOf(stack)).toEqual({ folders: 1, posts: 1, notes: true, schema, file: expect.any(String) });
	expect(await schemaInFile(stack.schemaFile)).toEqual(schema);
	expect(await stack.monti.entries.get({ id: done.entry.id })).toEqual(done.published);
	const events = notices.map((notice) => notice.event);
	const operations = ["folders.create", "entries.create", "entries.publish", "schema.update"];
	expect(events.map((event) => event.operation)).toEqual(operations);
	expect(events.map((event) => event.output)).toEqual([done.folder, done.entry, done.published, done.schema]);
	const atEachNotice = operations.map(() => schema);
	expect(notices.map((notice) => schemaOfText(notice.file))).toEqual(atEachNotice);
	expect(await Promise.all(notices.map((notice) => notice.schema))).toEqual(atEachNotice);
}

/** 관리자·세션·키의 쓰기는 비밀번호·토큰·키가 새지 않도록 구독자에게 통지하지 않는다. */
async function expectSilentWrites(stack: Stack, notices: Notice[]) {
	const account = { email: "owner@example.com", password: "owner-password" };
	await stack.monti.admin.create(account);
	await stack.monti.session.create(account);
	await stack.monti.keys.create({ service: "mail", name: "메일", secret: "mail-key-1234" });
	expect(notices).toHaveLength(4);
}

it(
	"시나리오 3: 묶은 쓰기는 실패하면 모두 되돌리고, 시험 실행은 아무것도 남기지 않으며, 커밋된 쓰기만 파일에 반영한 뒤 순서대로 통지한다",
	SCENARIO,
	async () => {
		const stack = await boot(BLOG, { dev: true }, SECRET);
		const notices = recordEvents(stack);
		await expectRolledBack(stack, notices);
		await expectDryRun(stack, notices);
		await expectCommitted(stack, notices);
		await expectSilentWrites(stack, notices);
	},
);

// 시나리오 4: 인증 · 키 · 플러그인을 한 서버에서 함께 쓴다

const NEWS: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text", required: true } } } },
};
const KEY_SECRET = "audit-mail-key-5678";

/** 플러그인이 더하는 감사 기록 테이블. `$extendTables`가 테이블 이름의 인덱스 시그니처를 바라므로 `type`으로 둔다. */
type AuditTables = {
	plugin_audit: { id: string; operation: string; entry_id: string; folder_id: string | null };
};

/** 플러그인의 첫 마이그레이션: 코어 `folders`를 가리키는 감사 기록 테이블. */
async function createAuditTable(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("plugin_audit")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("operation", "text", (column) => column.notNull())
		.addColumn("entry_id", "uuid", (column) => column.notNull())
		.addColumn("folder_id", "uuid", (column) => column.references("folders.id"))
		.execute();
}

const recordInput = z.object({ operation: z.string(), entry_id: z.uuid(), folder_id: z.uuid().nullable() });

/** 코어 `folders`에서 활성 폴더인지 확인한 뒤 감사 기록을 남긴다. */
async function recordAudit(input: z.infer<typeof recordInput>, ctx: WriteContext): Promise<{ id: string }> {
	if (input.folder_id !== null) {
		const folder = await ctx.db
			.selectFrom("folders")
			.select("id")
			.where("id", "=", input.folder_id)
			.where("trashed_at", "is", null)
			.executeTakeFirst();
		if (folder === undefined) throw new MontiError("NOT_FOUND", "감사할 글의 폴더가 없다");
	}
	const id = randomUUID();
	await ctx.db
		.$extendTables<AuditTables>()
		.insertInto("plugin_audit")
		.values({ id, ...input })
		.execute();
	return { id };
}

/** 감사 기록을 코어 `folders`와 이어 폴더 이름과 함께 읽는다. */
async function listAudit(_input: unknown, ctx: ReadContext) {
	const db: Kysely<Database> = ctx.db;
	return db
		.$extendTables<AuditTables>()
		.selectFrom("plugin_audit as a")
		.leftJoin("folders as f", "f.id", "a.folder_id")
		.select(["a.operation", "a.entry_id", "f.name as folder_name"])
		.execute();
}

/** 플러그인 Operation을 부르는 쪽이 보는 모양. */
interface AuditClient {
	record(input: z.infer<typeof recordInput>): Promise<{ id: string }>;
	list(): Promise<{ operation: string; entry_id: string; folder_name: string | null }[]>;
}

/** 플러그인의 `audit` Operation들: 코어의 `monti` 타입에는 없으므로 이름으로 꺼낸다. */
function auditOf(monti: object): AuditClient {
	return Reflect.get(monti, "audit");
}

/** 훅이 받는 `ctx.monti`의 core `entries` Operation들: 플러그인이 받는 `Monti` 타입은 core 리소스를 모르므로 이름으로 꺼낸다. */
function entriesOf(monti: object): CoreMonti["entries"] {
	return Reflect.get(monti, "entries");
}

/** 플러그인이 테스트에 남기는 것: 키 확인 함수가 받은 비밀값, 끝나기를 기다릴 훅, 훅이 통지 시점에 `ctx.monti`로 읽은 발행본. */
interface AuditProbe {
	checked: string[];
	hooks: Promise<void>[];
	published: Entry[];
}

/** 발행 이벤트를 받으면 `ctx.monti`로 먼저 그 발행본을 읽어 `published`에 남기고, 플러그인의 쓰기 Operation을 불러 감사 기록을 남긴다. */
async function auditPublish(event: MontiEvent, monti: Monti, published: Entry[]): Promise<void> {
	if (event.operation !== "entries.publish") return;
	const entry = event.output as { id: string; folder_id: string | null };
	published.push(await entriesOf(monti).get({ id: entry.id, status: "published" }));
	await auditOf(monti).record({ operation: event.operation, entry_id: entry.id, folder_id: entry.folder_id });
}

/** 감사 플러그인: 자체 테이블 마이그레이션, 읽기·쓰기 Operation, 키 확인 함수, 발행 이벤트 훅. 확인 함수와 훅이 본 것을 `probe`에 남긴다. */
function auditPlugin(probe: AuditProbe): Plugin {
	return {
		name: "audit",
		migrations: [{ name: "0001-plugin-audit", up: createAuditTable }],
		operations: {
			audit: {
				record: defineWrite({ input: recordInput, run: recordAudit }),
				list: defineRead({ input: z.object({}), run: listAudit }),
			},
		},
		keyServices: [
			{
				service: "audit-mail",
				check: async (secret) => {
					probe.checked.push(secret);
				},
			},
		],
		onEvent: (event, ctx) => {
			const hook = auditPublish(event, ctx.monti, probe.published);
			probe.hooks.push(hook);
			return hook;
		},
	};
}

/** 최초 관리자를 만들고, 로그인해 세션을 확인한 뒤 로그아웃한다. */
async function signInAndOut(monti: CoreMonti) {
	const account = { email: "editor@example.com", password: "editor-password" };
	const admin = await monti.admin.create(account);
	const { token } = await monti.session.create(account);
	expect(await monti.session.get({ token })).toEqual({ admin: { id: admin.id, email: account.email } });
	await monti.session.delete({ token });
	expect(await monti.session.get({ token })).toEqual({ admin: null });
}

/** 저장된 키로 연결을 확인하면 플러그인의 확인 함수가 복호화된 비밀값을 받는다. 돌려주는 키에는 비밀값이 없고 DB에는 암호문만 남는다. */
async function checkStoredKey(stack: Stack, checked: string[]) {
	const key = await stack.monti.keys.create({ service: "audit-mail", name: "감사 메일", secret: KEY_SECRET });
	// 공개 필드만 있다: `toStrictEqual`은 값이 `undefined`인 `secret` 키가 붙어 있어도 실패한다.
	expect(key).toStrictEqual({ id: expect.any(String), service: "audit-mail", name: "감사 메일", last4: "5678" });
	expect(await stack.monti.keys.check({ id: key.id })).toEqual({ ok: true });
	expect(checked).toEqual([KEY_SECRET]);
	const stored = await stack.db.selectFrom("api_keys").select("secret").executeTakeFirstOrThrow();
	expect(stored.secret).not.toContain(KEY_SECRET);
}

/**
 * 폴더 안의 글을 발행하면 플러그인 훅이 통지 시점에 `ctx.monti`로 그 발행본을 읽고 감사 기록을 남기며, 플러그인의 읽기
 * Operation이 폴더 이름과 함께 돌려준다.
 */
async function publishWithAudit(stack: Stack, probe: AuditProbe) {
	const folder = await stack.monti.folders.create({ scope: "posts", name: "보도자료" });
	const fields = { title: "출시 소식" };
	const post = await stack.monti.entries.create({
		collection: "posts",
		locale: "ko",
		slug: "launch",
		folder_id: folder.id,
		fields,
	});
	const published = await stack.monti.entries.publish({ id: post.id });
	await Promise.all(probe.hooks);
	// 훅이 통지를 받은 시점에 발행본이 이미 커밋되어 있어 `ctx.monti`로 읽힌다.
	expect(probe.published).toEqual([published]);
	const audits = stack.db.$extendTables<AuditTables>().selectFrom("plugin_audit");
	const rows = await audits.select(["operation", "entry_id", "folder_id"]).execute();
	expect(rows).toEqual([{ operation: "entries.publish", entry_id: post.id, folder_id: folder.id }]);
	const joined = [{ operation: "entries.publish", entry_id: post.id, folder_name: "보도자료" }];
	expect(await auditOf(stack.monti).list()).toEqual(joined);
}

it(
	"시나리오 4: 관리자 로그인, 저장된 키 확인, 플러그인의 테이블·Operation·이벤트 훅이 코어와 함께 동작한다",
	SCENARIO,
	async () => {
		const probe: AuditProbe = { checked: [], hooks: [], published: [] };
		const stack = await boot(NEWS, { dev: true, plugins: [auditPlugin(probe)] }, SECRET);
		await signInAndOut(stack.monti);
		await checkStoredKey(stack, probe.checked);
		await publishWithAudit(stack, probe);
	},
);
