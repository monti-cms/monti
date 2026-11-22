import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	defineRead,
	defineWrite,
	type MontiConfig,
	migrateMonti,
	type Plugin,
	type Schema,
	type StorageAdapter,
	startMonti,
} from "@monti-cms/core";
import { afterEach, expect, it } from "vitest";
import { z } from "zod";
import { createTestDatabase } from "../__test__/database";
import type { HttpHandler, HttpHandlerOptions } from "../protocol/types";
import { createHttpHandler } from "./handler";

const EMAIL = "admin@example.com";
const PASSWORD = "correct-password";

/** 관계 대상 `authors`와, `author` 관계 필드를 가진 `posts`. */
const schema: Schema = {
	locales: ["ko"],
	collections: {
		authors: { fields: {} },
		posts: { fields: { author: { type: "relation", to: "authors" } } },
	},
};

/** 템플릿 본문으로 쓰는 문단 하나짜리 문서. */
const PLAIN = { blocks: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "안녕" }] }] };

/** 목록·생성·고유 액션과, 실행하면 내부 오류를 던지는 액션을 가진 `notes` 리소스를 더하는 테스트용 플러그인. */
const notesPlugin: Plugin = {
	name: "notes-plugin",
	operations: {
		notes: {
			list: defineRead({ input: z.object({}), run: async () => [{ id: "n1", title: "첫 메모" }] }),
			create: defineWrite({
				input: z.object({ title: z.string() }),
				run: async (input) => ({ id: "n2", title: input.title }),
			}),
			archive: defineWrite({ input: z.object({ id: z.string() }), run: async (input) => ({ archived: input.id }) }),
			explode: defineWrite({
				input: z.object({}),
				run: async () => {
					throw new Error("secret internal failure");
				},
			}),
		},
	},
};

/** 메서드 함수만 가진 저장소 어댑터. */
const storage: StorageAdapter = {
	ticket: async (key) => ({ url: `memory://upload/${key}`, headers: {} }),
	stat: async () => null,
	url: (key) => `memory://${key}`,
	remove: async () => {},
};

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

interface SetupOptions {
	config?: Partial<MontiConfig>;
	options?: HttpHandlerOptions;
	/** 관리자를 먼저 만들지. 만들면 그 세션 쿠키를 `session`으로 돌려준다(기본: 만든다). */
	admin?: boolean;
}

/** 새 테스트 DB에 마이그레이션한 `monti`와 그 위의 핸들러. */
async function setup({ config = {}, options, admin = true }: SetupOptions = {}) {
	const { db, drop } = await createTestDatabase();
	const dir = await mkdtemp(path.join(tmpdir(), "monti-http-"));
	cleanups.push(drop, () => rm(dir, { recursive: true, force: true }));
	const full: MontiConfig = { name: "테스트 사이트", dev: true, ...config };
	await migrateMonti({ db, schema, config: { ...full, dev: true } });
	const files = { schemaFile: path.join(dir, "monti.schema.ts"), configFile: path.join(dir, "monti.config.ts") };
	const monti = startMonti({ db, schema, config: full, ...files });
	const handler = createHttpHandler(monti, options);
	const created = admin ? await monti.admin.create({ email: EMAIL, password: PASSWORD }) : undefined;
	return { db, monti, handler, session: created === undefined ? "" : `monti_session=${created.token}`, created };
}

interface SendOptions {
	cookie?: string;
	json?: unknown;
	raw?: string;
	origin?: string;
}

/** `handler`에 `method path` 요청을 보낸다. `json`이나 `raw` 본문은 `Content-Type: application/json`으로 싣는다. */
function send(
	handler: HttpHandler,
	method: string,
	path: string,
	{ cookie, json, raw, origin = "http://localhost" }: SendOptions = {},
) {
	const headers = new Headers();
	if (cookie !== undefined) headers.set("cookie", cookie);
	const body = raw ?? (json === undefined ? undefined : JSON.stringify(json));
	if (body !== undefined) headers.set("content-type", "application/json");
	return handler(new Request(`${origin}${path}`, { method, headers, body }));
}

async function bodyOf(response: Response) {
	return JSON.parse(await response.text());
}

/** 응답 `Set-Cookie`의 `이름=값` 부분: 다음 요청의 `Cookie` 헤더로 쓴다. */
function cookieOf(response: Response): string {
	return (response.headers.get("set-cookie") ?? "").split(";")[0];
}

const login = { email: EMAIL, password: PASSWORD };

it("HTTP-HDL-1 최초 관리자를 생성하면 계정 정보를 돌려주고(`201`) 세션 쿠키를 설정하며 토큰 원문은 본문에서 숨긴다", async () => {
	const { handler } = await setup({ admin: false });
	const response = await send(handler, "POST", "/api/admin", { json: login });
	const follow = await send(handler, "GET", "/api/templates", { cookie: cookieOf(response) });
	// HTTP-HDL-1.1
	expect(response.status).toBe(201);
	// HTTP-HDL-1.2
	expect(await bodyOf(response)).toEqual({ id: expect.any(String), email: EMAIL });
	// HTTP-HDL-1.3
	expect(response.headers.get("set-cookie")).toMatch(/^monti_session=[^;]+; HttpOnly; .*SameSite=Lax; Max-Age=2592000/);
	// HTTP-HDL-1.4
	expect(follow.status).toBe(200);
});

it("HTTP-HDL-2 로그인하면 성공 응답(`200`)과 세션 쿠키를 돌려주고 응답 본문에는 토큰 원문을 숨긴다", async () => {
	const { handler } = await setup();
	const response = await send(handler, "POST", "/api/session", { json: login });
	const https = await send(handler, "POST", "/api/session", { json: login, origin: "https://example.com" });
	const follow = await send(handler, "GET", "/api/templates", { cookie: cookieOf(response) });
	// HTTP-HDL-2.1
	expect([response.status, await bodyOf(response)]).toEqual([200, { ok: true }]);
	// HTTP-HDL-2.2
	expect([response.headers.get("set-cookie"), response.headers.get("set-cookie")?.includes("; Secure")]).toEqual([
		expect.stringMatching(/^monti_session=[^;]+; HttpOnly/),
		false,
	]);
	// HTTP-HDL-2.3
	expect(follow.status).toBe(200);
	// HTTP-HDL-2.4
	expect(https.headers.get("set-cookie")).toContain("; Secure");
});

it("HTTP-HDL-3 현재 로그인 상태를 물으면(`GET /api/session`) 쿠키가 없거나 만료된 세션에는 관리자 없음을, 유효한 세션에는 관리자 정보를 돌려준다(`200`)", async () => {
	const { db, monti, handler, session: expired, created } = await setup();
	await db
		.updateTable("session")
		.set({ expires_at: new Date(0) })
		.execute();
	const { token } = await monti.session.create(login);
	const anonymous = await send(handler, "GET", "/api/session");
	const stale = await send(handler, "GET", "/api/session", { cookie: expired });
	const valid = await send(handler, "GET", "/api/session", { cookie: `monti_session=${token}` });
	// HTTP-HDL-3.1
	expect([anonymous.status, await bodyOf(anonymous)]).toEqual([200, { admin: null }]);
	// HTTP-HDL-3.2
	expect([stale.status, await bodyOf(stale)]).toEqual([200, { admin: null }]);
	// HTTP-HDL-3.3
	expect([valid.status, await bodyOf(valid)]).toEqual([200, { admin: { id: created?.id, email: EMAIL } }]);
});

it("HTTP-HDL-4 로그아웃하면 본문의 토큰보다 쿠키의 토큰을 우선해 DB 세션을 지우고 빈 응답(`204`)과 쿠키 만료 삭제 헤더를 돌려준다", async () => {
	const { handler, session } = await setup();
	const response = await send(handler, "DELETE", "/api/session", { cookie: session, json: { token: "wrong-token" } });
	const follow = await send(handler, "GET", "/api/templates", { cookie: session });
	// HTTP-HDL-4.1
	expect([response.status, await response.text()]).toEqual([204, ""]);
	// HTTP-HDL-4.2
	expect(response.headers.get("set-cookie")).toMatch(/^monti_session=; .*Max-Age=0/);
	// HTTP-HDL-4.3
	expect(follow.status).toBe(401);
});

it("HTTP-HDL-5 관리자 계정을 변경하면 모든 세션을 지우고 현재 세션 쿠키도 만료 삭제한다", async () => {
	const { handler, session } = await setup();
	const json = { currentPassword: PASSWORD, email: "new@example.com", password: "new-password" };
	const response = await send(handler, "PATCH", "/api/admin", { cookie: session, json });
	const follow = await send(handler, "GET", "/api/templates", { cookie: session });
	// HTTP-HDL-5.1
	expect([response.status, (await bodyOf(response)).email]).toEqual([200, "new@example.com"]);
	// HTTP-HDL-5.2
	expect(response.headers.get("set-cookie")).toMatch(/^monti_session=; .*Max-Age=0/);
	// HTTP-HDL-5.3
	expect(follow.status).toBe(401);
});

it("HTTP-HDL-6 표준 CRUD 작업은 생성(`201`), 조회·수정(`200`), 빈 반환 삭제(`204`)의 상태 코드와 본문을 돌려준다", async () => {
	const { db, handler, session: cookie } = await setup();
	const json = { collection: "posts", name: "기본", content: PLAIN };
	const create = await send(handler, "POST", "/api/templates", { cookie, json });
	const created = await bodyOf(create);
	const list = await send(handler, "GET", "/api/templates", { cookie });
	const get = await send(handler, "GET", `/api/templates/${created.id}`, { cookie });
	const update = await send(handler, "PATCH", `/api/templates/${created.id}`, { cookie, json: { name: "새 이름" } });
	const remove = await send(handler, "DELETE", `/api/templates/${created.id}`, { cookie });
	const rows = await db.selectFrom("templates").selectAll().execute();
	// HTTP-HDL-6.1
	expect([create.status, created]).toEqual([
		201,
		{ id: expect.any(String), collection: "posts", name: "기본", content: PLAIN },
	]);
	// HTTP-HDL-6.2
	expect([list.status, await bodyOf(list), get.status, await bodyOf(get)]).toEqual([200, [created], 200, created]);
	// HTTP-HDL-6.3
	expect([update.status, await bodyOf(update)]).toEqual([200, { ...created, name: "새 이름" }]);
	// HTTP-HDL-6.4
	expect([remove.status, await remove.text(), rows]).toEqual([204, "", []]);
});

it("HTTP-HDL-7 글 목록 조회에서 `folder_id=null`과 점(`.`) 관계 쿼리 필터가 실제 DB 결과와 맞물려 동작한다", async () => {
	const { monti, handler, session: cookie } = await setup();
	const author = await monti.entries.create({ collection: "authors", locale: "ko" });
	const folder = await monti.folders.create({ scope: "posts", name: "하위" });
	const root = await monti.entries.create({ collection: "posts", locale: "ko", fields: { author: author.id } });
	await monti.entries.create({ collection: "posts", locale: "ko" });
	await monti.entries.create({
		collection: "posts",
		locale: "ko",
		folder_id: folder.id,
		fields: { author: author.id },
	});
	const query = `collection=posts&status=draft&folder_id=null&relation.field=author&relation.id=${author.id}`;
	const response = await send(handler, "GET", `/api/entries?${query}`, { cookie });
	const ids = (await bodyOf(response)).map((entry: { id: string }) => entry.id);
	// HTTP-HDL-7.1
	expect([response.status, ids]).toEqual([200, [root.id]]);
});

it("HTTP-HDL-8 다건 수정 요청(`PATCH /api/entries`)으로 여러 글의 폴더를 한 번에 바꿀 수 있다", async () => {
	const { monti, handler, session: cookie } = await setup();
	const first = await monti.entries.create({ collection: "posts", locale: "ko" });
	const second = await monti.entries.create({ collection: "posts", locale: "ko" });
	const folder = await monti.folders.create({ scope: "posts", name: "모음" });
	const json = { ids: [first.id, second.id], folder_id: folder.id };
	const response = await send(handler, "PATCH", "/api/entries", { cookie, json });
	const moved = await bodyOf(response);
	// HTTP-HDL-8.1
	expect([response.status, moved.length, moved]).toEqual([
		200,
		2,
		expect.arrayContaining([
			{ id: first.id, folder_id: folder.id },
			{ id: second.id, folder_id: folder.id },
		]),
	]);
});

it("HTTP-HDL-9 함수가 섞인 설정 단일 리소스(`GET /api/config`)를 오류 없이 안전하게 JSON으로 응답한다", async () => {
	const { handler, session: cookie } = await setup({ config: { storage, plugins: [notesPlugin] } });
	const response = await send(handler, "GET", "/api/config", { cookie });
	const config = await bodyOf(response);
	// HTTP-HDL-9.1
	expect([response.status, config.name]).toEqual([200, "테스트 사이트"]);
	// HTTP-HDL-9.2
	expect(Object.keys(config.storage)).toEqual([]);
});

it("HTTP-HDL-10 플러그인이 등록한 리소스와 고유 액션도 별도 설정 없이 같은 REST 규칙으로 호출할 수 있다", async () => {
	const { handler, session: cookie } = await setup({ config: { plugins: [notesPlugin] } });
	const list = await send(handler, "GET", "/api/notes", { cookie });
	const create = await send(handler, "POST", "/api/notes", { cookie, json: { title: "새 메모" } });
	const action = await send(handler, "POST", "/api/notes/archive", { cookie, json: { id: "n1" } });
	// HTTP-HDL-10.1
	expect([list.status, await bodyOf(list)]).toEqual([200, [{ id: "n1", title: "첫 메모" }]]);
	// HTTP-HDL-10.2
	expect([create.status, await bodyOf(create)]).toEqual([201, { id: "n2", title: "새 메모" }]);
	// HTTP-HDL-10.3
	expect([action.status, await bodyOf(action)]).toEqual([200, { archived: "n1" }]);
});

it("HTTP-HDL-11 쓰기 요청에 `?dryRun=true`를 붙이면 예상 결과만 돌려주고 실제 DB는 바꾸지 않는다", async () => {
	const { db, handler, session: cookie } = await setup();
	const json = { collection: "posts", name: "시험", content: PLAIN };
	const response = await send(handler, "POST", "/api/templates?dryRun=true", { cookie, json });
	const rows = await db.selectFrom("templates").selectAll().execute();
	// HTTP-HDL-11.1
	expect([response.status, await bodyOf(response)]).toEqual([
		201,
		{ id: expect.any(String), collection: "posts", name: "시험", content: PLAIN },
	]);
	// HTTP-HDL-11.2
	expect(rows).toEqual([]);
});

it("HTTP-HDL-12 인증·관리자 쓰기에 `?dryRun=true`를 붙이면 세션 쿠키를 발급하거나 지우지 않으며 토큰 원문도 노출하지 않는다", async () => {
	const fresh = await setup({ admin: false });
	const { db, handler, session } = await setup();
	const beforeSessions = await db.selectFrom("session").selectAll().execute();
	const admin = await send(fresh.handler, "POST", "/api/admin?dryRun=true", { json: login });
	const adminsAfter = await fresh.db.selectFrom("admin").selectAll().execute();
	const signIn = await send(handler, "POST", "/api/session?dryRun=true", { json: login });
	const sessionsAfter = await db.selectFrom("session").selectAll().execute();
	const signOut = await send(handler, "DELETE", "/api/session?dryRun=true", { cookie: session });
	const follow = await send(handler, "GET", "/api/templates", { cookie: session });
	// HTTP-HDL-12.1
	expect([admin.status, await bodyOf(admin), admin.headers.get("set-cookie"), adminsAfter]).toEqual([
		201,
		{ id: expect.any(String), email: EMAIL },
		null,
		[],
	]);
	// HTTP-HDL-12.2
	expect([signIn.status, await bodyOf(signIn), signIn.headers.get("set-cookie"), sessionsAfter.length]).toEqual([
		200,
		{ ok: true },
		null,
		beforeSessions.length,
	]);
	// HTTP-HDL-12.3
	expect([signOut.status, signOut.headers.get("set-cookie"), follow.status]).toEqual([204, null, 200]);
});

it("HTTP-HDL-13 `createHttpHandler`의 `basePath`와 `cookie` 옵션이 전체 요청 파이프라인에 적용된다", async () => {
	const { handler } = await setup({
		options: { basePath: "/cms", cookie: { name: "sid", path: "/cms", secure: true } },
	});
	const response = await send(handler, "POST", "/cms/session", { json: login });
	const follow = await send(handler, "GET", "/cms/templates", { cookie: cookieOf(response) });
	// HTTP-HDL-13.1
	expect(response.headers.get("set-cookie")).toMatch(
		/^sid=[^;]+; HttpOnly; Path=\/cms; SameSite=Lax; Max-Age=2592000; Secure$/,
	);
	// HTTP-HDL-13.2
	expect(follow.status).toBe(200);
});

it("HTTP-HDL-14 없는 경로·허용되지 않은 메서드는 인증보다 먼저 거절하고(`404`, `405`), 미인증 요청의 깨진 본문은 로그인 거절(`401`)이 먼저 돌아온다", async () => {
	const { handler } = await setup();
	const unknown = await send(handler, "GET", "/api/unknown");
	const method = await send(handler, "DELETE", "/api/schema");
	const broken = await send(handler, "POST", "/api/templates", { raw: "{broken" });
	// HTTP-HDL-14.1
	expect([unknown.status, (await bodyOf(unknown)).error.code]).toEqual([404, "NOT_FOUND"]);
	// HTTP-HDL-14.2
	expect([method.status, method.headers.get("allow"), (await bodyOf(method)).error.code]).toEqual([
		405,
		"GET, PATCH",
		"METHOD_NOT_ALLOWED",
	]);
	// HTTP-HDL-14.3
	expect([broken.status, (await bodyOf(broken)).error.code]).toEqual([401, "UNAUTHORIZED"]);
});

it("HTTP-HDL-15 로그인하지 않았거나 만료·위조된 세션 쿠키로 보호된 API를 호출하면 거절하고(`401`) DB를 바꾸지 않는다", async () => {
	const { db, handler, session: expired } = await setup();
	await db
		.updateTable("session")
		.set({ expires_at: new Date(0) })
		.execute();
	const json = { collection: "posts", name: "몰래", content: PLAIN };
	const results = [];
	for (const cookie of [undefined, expired, "monti_session=forged-token"]) {
		for (const method of ["GET", "POST"]) {
			const response = await send(handler, method, "/api/templates", {
				cookie,
				json: method === "POST" ? json : undefined,
			});
			results.push([response.status, (await bodyOf(response)).error.code]);
		}
	}
	const rows = await db.selectFrom("templates").selectAll().execute();
	// HTTP-HDL-15.1
	expect(results).toEqual(Array(6).fill([401, "UNAUTHORIZED"]));
	// HTTP-HDL-15.2
	expect(rows).toEqual([]);
});

it("HTTP-HDL-16 검증 실패·잘못된 로그인·권한 없음·없는 대상·중복 관리자가 각각의 HTTP 오류 상태와 JSON 형식으로 반환된다", async () => {
	const { monti, handler, session: cookie } = await setup({ config: { dev: false } });
	const entry = await monti.entries.create({ collection: "posts", locale: "ko", slug: "hello" });
	const invalid = await send(handler, "POST", "/api/templates", { cookie, json: { collection: "posts" } });
	const wrong = await send(handler, "POST", "/api/session", { json: { email: EMAIL, password: "wrong-password" } });
	const forbidden = await send(handler, "PATCH", "/api/config", { cookie, json: { name: "새 이름" } });
	const missing = await send(handler, "GET", `/api/templates/${randomUUID()}`, { cookie });
	const duplicate = await send(handler, "POST", "/api/admin", { json: login });
	const bypassMove = await send(handler, "PATCH", "/api/entries/invalid-id", {
		cookie,
		json: { ids: [entry.id], folder_id: null },
	});
	const bypassSlug = await send(handler, "GET", "/api/entries/invalid-id?collection=posts&locale=ko&slug=hello", {
		cookie,
	});
	// HTTP-HDL-16.1
	expect([invalid.status, (await bodyOf(invalid)).error.code]).toEqual([400, "BAD_REQUEST"]);
	// HTTP-HDL-16.2
	expect([wrong.status, (await bodyOf(wrong)).error.code]).toEqual([401, "UNAUTHORIZED"]);
	// HTTP-HDL-16.3
	expect([forbidden.status, (await bodyOf(forbidden)).error.code]).toEqual([403, "FORBIDDEN"]);
	// HTTP-HDL-16.4
	expect([missing.status, (await bodyOf(missing)).error.code]).toEqual([404, "NOT_FOUND"]);
	// HTTP-HDL-16.5
	expect([duplicate.status, (await bodyOf(duplicate)).error.code]).toEqual([409, "CONFLICT"]);
	// HTTP-HDL-16.6
	expect([
		bypassMove.status,
		(await bodyOf(bypassMove)).error.code,
		bypassSlug.status,
		(await bodyOf(bypassSlug)).error.code,
	]).toEqual([400, "BAD_REQUEST", 400, "BAD_REQUEST"]);
});

it("HTTP-HDL-17 작업 실행 중 예기치 않은 내부 오류가 나면 내부 상세를 숨기고 서버 오류(`500`)를 돌려준다", async () => {
	const { handler, session: cookie } = await setup({ config: { plugins: [notesPlugin] } });
	const response = await send(handler, "POST", "/api/notes/explode", { cookie });
	const text = await response.text();
	// HTTP-HDL-17.1
	expect([response.status, JSON.parse(text).error.code]).toEqual([500, "INTERNAL_ERROR"]);
	// HTTP-HDL-17.2
	expect(text).not.toContain("secret internal failure");
});

it("HTTP-HDL-18 현재 비밀번호가 틀려 관리자 계정 변경에 실패하면 세션 쿠키를 지우지 않는다", async () => {
	const { handler, session } = await setup();
	const json = { currentPassword: "wrong-password", email: "new@example.com", password: "new-password" };
	const response = await send(handler, "PATCH", "/api/admin", { cookie: session, json });
	const follow = await send(handler, "GET", "/api/templates", { cookie: session });
	// HTTP-HDL-18.1
	expect([response.status, response.headers.get("set-cookie")]).toEqual([401, null]);
	// HTTP-HDL-18.2
	expect(follow.status).toBe(200);
});
