import { defineRead, defineWrite, type Plugin, specOf } from "@monti-cms/core";
import { expect, it } from "vitest";
import { z } from "zod";
import { parseInput } from "./input";
import { createRouteTable, matchRoute } from "./match";
import type { RouteTable } from "./types";

/** 단일 리소스 `settings.get`, 고유 쓰기 액션 `jobs.run`, 쿼리 변환을 볼 `probes.list`를 더하는 테스트용 플러그인. */
const plugin: Plugin = {
	name: "probe",
	operations: {
		settings: { get: defineRead({ input: z.object({}), run: async () => ({}) }) },
		jobs: { run: defineWrite({ input: z.object({}), run: async () => ({}) }) },
		probes: {
			list: defineRead({
				input: z.object({
					folder_id: z.string().nullable(),
					limit: z.number().int(),
					score: z.number(),
					draft: z.boolean(),
					code: z.string(),
					relation: z.object({ field: z.string(), id: z.string() }),
					tags: z.array(z.string()),
				}),
				run: async () => [],
			}),
		},
	},
};

const core = createRouteTable(specOf(), "/api");
const withPlugin = createRouteTable(specOf([plugin]), "/api");

/** 매칭 결과를 비교하기 쉬운 모양으로: 맞으면 Operation 이름·종류와 경로 `id`, 아니면 결과 그대로. */
function route(table: RouteTable, method: string, pathname: string) {
	const result = matchRoute(table, method, pathname);
	if (result.kind !== "match") return result;
	return { name: result.operation.name, kind: result.operation.kind, id: result.id };
}

interface Body {
	body: string | Uint8Array;
	type?: string;
}

/** `path`(쿼리 포함) 요청을 `table`에서 매칭하고 입력을 조립한다. */
async function parse(table: RouteTable, method: string, path: string, body?: Body) {
	const url = new URL(path, "http://localhost");
	const result = matchRoute(table, method, url.pathname);
	if (result.kind !== "match") throw new Error(`테스트 준비 오류: ${method} ${path}가 매칭되지 않았다`);
	const headers = body?.type === undefined ? undefined : { "content-type": body.type };
	return parseInput(result, new Request(url, { method, headers, body: body?.body }));
}

const json = (value: unknown): Body => ({ body: JSON.stringify(value), type: "application/json" });
const BAD_REQUEST = { code: "BAD_REQUEST" };

it("HTTP-RUT-1 표준 동사(`list`, `get`, `create`, `update`, `delete`)를 각각의 HTTP 메서드와 경로로 매핑하고 `GET /<resource>`에서는 목록을 우선한다", () => {
	// HTTP-RUT-1.1
	expect(route(core, "GET", "/api/templates")).toMatchObject({ name: "templates.list" });
	// HTTP-RUT-1.2
	expect(route(core, "GET", "/api/entries")).toMatchObject({ name: "entries.list" });
	// HTTP-RUT-1.3
	expect(route(core, "GET", "/api/templates/t1")).toMatchObject({ name: "templates.get", id: "t1" });
	// HTTP-RUT-1.4
	expect(route(core, "POST", "/api/templates")).toMatchObject({ name: "templates.create" });
	// HTTP-RUT-1.5
	expect(route(core, "PATCH", "/api/templates/t1")).toMatchObject({ name: "templates.update", id: "t1" });
	// HTTP-RUT-1.6
	expect(route(core, "DELETE", "/api/templates/t1")).toMatchObject({ name: "templates.delete", id: "t1" });
});

it("HTTP-RUT-2 목록이 없는 단일 리소스는 `:id` 없는 경로로 조회·수정·삭제에 매핑한다", () => {
	// HTTP-RUT-2.1
	expect([route(withPlugin, "GET", "/api/schema"), route(withPlugin, "PATCH", "/api/schema")]).toEqual([
		{ name: "schema.get", kind: "read", id: undefined },
		{ name: "schema.update", kind: "write", id: undefined },
	]);
	// HTTP-RUT-2.2
	expect([
		route(withPlugin, "GET", "/api/session"),
		route(withPlugin, "DELETE", "/api/session"),
		route(withPlugin, "PATCH", "/api/admin"),
	]).toEqual([
		{ name: "session.get", kind: "read", id: undefined },
		{ name: "session.delete", kind: "write", id: undefined },
		{ name: "admin.update", kind: "write", id: undefined },
	]);
	// HTTP-RUT-2.3
	expect(route(withPlugin, "GET", "/api/settings")).toEqual({ name: "settings.get", kind: "read", id: undefined });
});

it("HTTP-RUT-3 단건과 다건 입력을 함께 받는 리소스는 `:id` 유무로 경로를 나눠 매핑한다", () => {
	// HTTP-RUT-3.1
	expect(route(core, "PATCH", "/api/entries/e1")).toMatchObject({ name: "entries.update", id: "e1" });
	// HTTP-RUT-3.2
	expect(route(core, "PATCH", "/api/entries")).toEqual({ name: "entries.update", kind: "write", id: undefined });
	// HTTP-RUT-3.3
	expect(route(core, "DELETE", "/api/trash/t1")).toMatchObject({ name: "trash.delete", id: "t1" });
	// HTTP-RUT-3.4
	expect(route(core, "DELETE", "/api/trash")).toEqual({ name: "trash.delete", kind: "write", id: undefined });
});

it("HTTP-RUT-4 표준 동사 외의 고유 액션과 플러그인 액션을 이름 대소문자 그대로 `POST /<resource>/<action>`으로 매핑한다", () => {
	// HTTP-RUT-4.1
	expect([
		route(withPlugin, "POST", "/api/entries/publish"),
		route(withPlugin, "POST", "/api/media/startUpload"),
	]).toEqual([
		{ name: "entries.publish", kind: "write", id: undefined },
		{ name: "media.startUpload", kind: "write", id: undefined },
	]);
	// HTTP-RUT-4.2
	expect(route(withPlugin, "POST", "/api/keys/check")).toEqual({ name: "keys.check", kind: "read", id: undefined });
	// HTTP-RUT-4.3
	expect(route(withPlugin, "POST", "/api/jobs/run")).toEqual({ name: "jobs.run", kind: "write", id: undefined });
});

it('HTTP-RUT-5 사용자 지정 `basePath`와 루트 기준(`""`, `"/"`)에서 경로를 매칭한다', () => {
	const nested = createRouteTable(specOf(), "/admin/api");
	const empty = createRouteTable(specOf(), "");
	const slash = createRouteTable(specOf(), "/");
	// HTTP-RUT-5.1
	expect(route(nested, "GET", "/admin/api/templates")).toMatchObject({ name: "templates.list" });
	// HTTP-RUT-5.2
	expect(route(empty, "GET", "/entries/e1")).toMatchObject({ name: "entries.get", id: "e1" });
	// HTTP-RUT-5.3
	expect(route(slash, "GET", "/entries/e1")).toMatchObject({ name: "entries.get", id: "e1" });
});

it("HTTP-RUT-6 경로 끝 슬래시를 제거하고 퍼센트 인코딩된 `:id` 세그먼트를 디코딩해 매칭한다", () => {
	// HTTP-RUT-6.1
	expect(route(core, "GET", "/api/templates/")).toEqual({ name: "templates.list", kind: "read", id: undefined });
	// HTTP-RUT-6.2
	expect(route(core, "GET", "/api/templates/id%2F1")).toMatchObject({ name: "templates.get", id: "id/1" });
});

it("HTTP-RUT-7 API 밖의 경로, 경계가 다른 접두 경로, 없는 리소스·단일 리소스 `:id`·3단 이상 경로는 찾을 수 없음(`404`)으로 분류한다", () => {
	const requests = [
		["GET", "/other/entries"],
		["GET", "/api_templates"],
		["GET", "/api"],
		["GET", "/api/unknown"],
		["GET", "/api/schema/abc"],
		["POST", "/api/schema/unknown"],
		["GET", "/api/entries/a/b"],
	];
	const results = requests.map(([method, pathname]) => matchRoute(core, method, pathname));
	// HTTP-RUT-7.1
	expect(results).toEqual(Array(7).fill({ kind: "not_found" }));
});

it("HTTP-RUT-8 다른 메서드로 열린 경로에 허용되지 않은 메서드를 보내면 정해진 순서의 허용 목록과 함께 거절한다(`405`)", () => {
	// HTTP-RUT-8.1
	expect(matchRoute(core, "DELETE", "/api/schema")).toEqual({ kind: "method_not_allowed", allow: ["GET", "PATCH"] });
	// HTTP-RUT-8.2
	expect(matchRoute(core, "PATCH", "/api/templates")).toEqual({ kind: "method_not_allowed", allow: ["GET", "POST"] });
	// HTTP-RUT-8.3
	expect(matchRoute(core, "POST", "/api/entries/unknown")).toEqual({
		kind: "method_not_allowed",
		allow: ["GET", "PATCH"],
	});
	// HTTP-RUT-8.4
	expect(matchRoute(core, "POST", "/api/templates/t1")).toEqual({
		kind: "method_not_allowed",
		allow: ["GET", "PATCH", "DELETE"],
	});
});

it("HTTP-RUT-9 표준 동사를 `POST /<resource>/<verb>` 액션 경로로 호출하는 것을 허용하지 않는다", () => {
	// HTTP-RUT-9.1
	expect([
		matchRoute(core, "POST", "/api/entries/list"),
		matchRoute(core, "POST", "/api/entries/create"),
		matchRoute(core, "POST", "/api/entries/update"),
		matchRoute(core, "POST", "/api/templates/delete"),
	]).toEqual([
		{ kind: "method_not_allowed", allow: ["GET", "PATCH"] },
		{ kind: "method_not_allowed", allow: ["GET", "PATCH"] },
		{ kind: "method_not_allowed", allow: ["GET", "PATCH"] },
		{ kind: "method_not_allowed", allow: ["GET", "PATCH", "DELETE"] },
	]);
	// HTTP-RUT-9.2
	expect(matchRoute(core, "POST", "/api/schema/get")).toEqual({ kind: "not_found" });
});

it("HTTP-RUT-10 경로 세그먼트의 퍼센트 인코딩이 잘못되었으면 거절한다(`400`)", () => {
	// HTTP-RUT-10.1
	expect(() => matchRoute(core, "GET", "/api/templates/%E0%A4%A")).toThrow(expect.objectContaining(BAD_REQUEST));
});

it("HTTP-RUT-11 `GET` 쿼리를 작업 명세 타입(`null`·숫자·참거짓)과 점(`.`) 중첩 객체로 변환한다", async () => {
	const first = await parse(
		withPlugin,
		"GET",
		"/api/probes?folder_id=null&limit=20&score=3.5&draft=true&code=123&relation.field=author&relation.id=u1",
	);
	const second = await parse(withPlugin, "GET", "/api/probes?folder_id=abc&draft=false");
	// HTTP-RUT-11.1
	expect(first.input).toEqual({
		folder_id: null,
		limit: 20,
		score: 3.5,
		draft: true,
		code: "123",
		relation: { field: "author", id: "u1" },
	});
	// HTTP-RUT-11.2
	expect(second.input).toEqual({ folder_id: "abc", draft: false });
});

it("HTTP-RUT-12 `GET` 쿼리의 배열 속성은 값이 하나만 와도 배열로, 여러 번 오면 모두 배열로 모은다", async () => {
	const single = await parse(withPlugin, "GET", "/api/probes?tags=only");
	const many = await parse(withPlugin, "GET", "/api/probes?tags=a&tags=b");
	// HTTP-RUT-12.1
	expect(single.input).toEqual({ tags: ["only"] });
	// HTTP-RUT-12.2
	expect(many.input).toEqual({ tags: ["a", "b"] });
});

it("HTTP-RUT-13 경로 `:id`와 쿼리 또는 JSON 본문을 합쳐 입력을 만들며 경로 `:id`가 우선한다", async () => {
	const get = await parse(core, "GET", "/api/entries/path-id?locale=en&id=query-id");
	const patch = await parse(core, "PATCH", "/api/templates/path-id", {
		body: JSON.stringify({ id: "body-id", name: "새 이름" }),
		type: "application/json ; charset=utf-8",
	});
	// HTTP-RUT-13.1
	expect(get.input).toEqual({ id: "path-id", locale: "en" });
	// HTTP-RUT-13.2
	expect(patch.input).toEqual({ id: "path-id", name: "새 이름" });
});

it("HTTP-RUT-14 쓰기 요청의 `?dryRun=true`를 시험 실행 플래그로 분리하고 입력 객체에서는 뺀다", async () => {
	const body = { collection: "posts", locale: "ko" };
	const dry = await parse(core, "POST", "/api/entries?dryRun=true", json(body));
	const real = await parse(core, "POST", "/api/entries?dryRun=false", json(body));
	const read = await parse(core, "GET", "/api/entries?dryRun=false&collection=posts");
	// HTTP-RUT-14.1
	expect(dry).toEqual({ dryRun: true, input: { collection: "posts", locale: "ko" } });
	// HTTP-RUT-14.2
	expect(real.dryRun).toBe(false);
	// HTTP-RUT-14.3
	expect(read).toEqual({ dryRun: false, input: { collection: "posts" } });
});

it("HTTP-RUT-15 `GET` 쿼리에서 명세 타입으로 바꿀 수 없는 값은 거절하지 않고 문자열 그대로 둔다", async () => {
	const parsed = await parse(withPlugin, "GET", "/api/probes?limit=abc&score=&draft=yes");
	// HTTP-RUT-15.1
	expect(parsed.input).toEqual({ limit: "abc", score: "", draft: "yes" });
});

it("HTTP-RUT-16 읽기 작업에 `?dryRun=true`를 붙이면 거절한다(`400`)", async () => {
	// HTTP-RUT-16.1
	await expect(parse(core, "GET", "/api/entries?dryRun=true")).rejects.toMatchObject(BAD_REQUEST);
	// HTTP-RUT-16.2
	await expect(parse(core, "POST", "/api/keys/check?dryRun=true")).rejects.toMatchObject(BAD_REQUEST);
});

it("HTTP-RUT-17 `dryRun` 값이 `true`나 `false`가 아니면 거절한다(`400`)", async () => {
	// HTTP-RUT-17.1
	await expect(parse(core, "POST", "/api/entries?dryRun=yes")).rejects.toMatchObject(BAD_REQUEST);
	// HTTP-RUT-17.1
	await expect(parse(core, "POST", "/api/entries?dryRun=1")).rejects.toMatchObject(BAD_REQUEST);
});

it("HTTP-RUT-18 쓰기 요청에 `dryRun` 외의 쿼리 키가 하나라도 붙으면 거절한다(`400`)", async () => {
	// HTTP-RUT-18.1
	await expect(parse(core, "POST", "/api/entries?dryrun=true")).rejects.toMatchObject(BAD_REQUEST);
	// HTTP-RUT-18.1
	await expect(parse(core, "DELETE", "/api/trash?dry_run=true")).rejects.toMatchObject(BAD_REQUEST);
	// HTTP-RUT-18.1
	await expect(parse(core, "POST", "/api/entries?locale=ko")).rejects.toMatchObject(BAD_REQUEST);
});

it("HTTP-RUT-19 본문이 비어 있지 않을 때 `Content-Type`이 `application/json`이 아니면 거절한다(`400`)", async () => {
	const text = '{"name":"a"}';
	const plain = parse(core, "POST", "/api/templates", { body: text, type: "text/plain" });
	const untyped = parse(core, "POST", "/api/templates", { body: new TextEncoder().encode(text) });
	// HTTP-RUT-19.1
	await expect(plain).rejects.toMatchObject(BAD_REQUEST);
	// HTTP-RUT-19.2
	await expect(untyped).rejects.toMatchObject(BAD_REQUEST);
});

it("HTTP-RUT-20 깨진 JSON 본문이나 객체가 아닌 최상위 JSON 본문은 거절한다(`400`)", async () => {
	const bodies = ["{broken", "[1,2]", "123", "null"];
	const results = await Promise.allSettled(
		bodies.map((body) => parse(core, "POST", "/api/templates", { body, type: "application/json" })),
	);
	const codes = results.map((result) => (result.status === "rejected" ? result.reason.code : "통과"));
	// HTTP-RUT-20.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
});

it("HTTP-RUT-21 본문이 비어 있는 쓰기 요청은 `Content-Type` 없이도 빈 객체로 처리한다", async () => {
	const template = await parse(core, "DELETE", "/api/templates/t1");
	const session = await parse(core, "DELETE", "/api/session");
	// HTTP-RUT-21.1
	expect(template.input).toEqual({ id: "t1" });
	// HTTP-RUT-21.2
	expect(session.input).toEqual({});
});

it("HTTP-RUT-22 점(`.`) 중첩 쿼리에 위험한 프로토타입 키가 들어 있으면 거절한다(`400`)", async () => {
	const queries = ["__proto__.polluted=1", "relation.constructor.x=1", "relation.prototype.y=1"];
	const results = await Promise.allSettled(queries.map((query) => parse(withPlugin, "GET", `/api/probes?${query}`)));
	const codes = results.map((result) => (result.status === "rejected" ? result.reason.code : "통과"));
	// HTTP-RUT-22.1
	expect(codes).toEqual(["BAD_REQUEST", "BAD_REQUEST", "BAD_REQUEST"]);
});
