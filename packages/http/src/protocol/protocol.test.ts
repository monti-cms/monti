import { MontiError } from "@monti-cms/core";
import { expect, it } from "vitest";
import { expiredCookie, readCookie, resolveCookie, sessionCookie } from "./cookie";
import { errorResponse, methodNotAllowedResponse, successResponse } from "./response";

const JSON_TYPE = "application/json; charset=utf-8";

it("HTTP-PRO-1 요청의 `Cookie` 헤더에서 지정한 이름의 쿠키 값을 꺼낸다", () => {
	const value = readCookie("theme=dark; monti_session=tok=en123==; lang=ko", "monti_session");
	// HTTP-PRO-1.1
	expect(value).toBe("tok=en123==");
});

it("HTTP-PRO-2 기본 옵션으로 세션 쿠키 발급 헤더를 만들면 `HttpOnly`와 기본 보안 속성이 들어간다", () => {
	const header = sessionCookie(resolveCookie(), "secret-token", false);
	// HTTP-PRO-2.1
	expect(header).toBe("monti_session=secret-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000");
});

it("HTTP-PRO-3 `secure` 옵션을 생략하면 요청이 HTTPS일 때만 `Secure` 속성이 붙는다", () => {
	const cookie = resolveCookie({});
	const http = sessionCookie(cookie, "secret-token", false);
	const https = sessionCookie(cookie, "secret-token", true);
	// HTTP-PRO-3.1
	expect(http).not.toContain("; Secure");
	// HTTP-PRO-3.2
	expect(https).toBe("monti_session=secret-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000; Secure");
});

it("HTTP-PRO-4 사용자 지정 쿠키 옵션이 발급 헤더에 반영되고 `HttpOnly`는 유지된다", () => {
	const custom = resolveCookie({ name: "sid", path: "/admin", sameSite: "strict", maxAge: 3600, secure: true });
	const insecure = resolveCookie({ secure: false });
	const none = resolveCookie({ sameSite: "none" });
	// HTTP-PRO-4.1
	expect(sessionCookie(custom, "secret-token", false)).toBe(
		"sid=secret-token; HttpOnly; Path=/admin; SameSite=Strict; Max-Age=3600; Secure",
	);
	// HTTP-PRO-4.2
	expect(sessionCookie(insecure, "secret-token", true)).toBe(
		"monti_session=secret-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000",
	);
	// HTTP-PRO-4.3
	expect(sessionCookie(none, "secret-token", false)).toBe(
		"monti_session=secret-token; HttpOnly; Path=/; SameSite=None; Max-Age=2592000; Secure",
	);
});

it("HTTP-PRO-5 세션 쿠키 삭제 헤더는 지정한 이름과 경로에 빈 값과 `Max-Age=0`으로 쿠키를 즉시 만료시킨다", () => {
	const header = expiredCookie(resolveCookie({ name: "sid", path: "/admin", sameSite: "strict" }), true);
	// HTTP-PRO-5.1
	expect(header).toBe("sid=; HttpOnly; Path=/admin; SameSite=Strict; Max-Age=0; Secure");
});

it("HTTP-PRO-6 성공 응답을 작업 성격에 맞는 상태(`200`, `201`, `204`)와 JSON 본문, 선택적 `Set-Cookie` 헤더로 만든다", async () => {
	const setCookie = "monti_session=secret-token; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000";
	const ok = successResponse(200, { id: "1" });
	const created = successResponse(201, { id: "1" }, setCookie);
	const empty = successResponse(204, undefined);
	// HTTP-PRO-6.1
	expect([ok.status, ok.headers.get("content-type"), ok.headers.get("cache-control"), await ok.text()]).toEqual([
		200,
		JSON_TYPE,
		"no-store",
		'{"id":"1"}',
	]);
	// HTTP-PRO-6.2
	expect([
		created.status,
		created.headers.get("cache-control"),
		created.headers.get("set-cookie"),
		await created.text(),
	]).toEqual([201, "no-store", setCookie, '{"id":"1"}']);
	// HTTP-PRO-6.3
	expect([
		empty.status,
		empty.headers.get("cache-control"),
		empty.headers.get("content-type"),
		await empty.text(),
	]).toEqual([204, "no-store", null, ""]);
});

it("HTTP-PRO-7 함수·순환 참조·큰 정수가 섞인 값도 안전하게 JSON 응답으로 직렬화한다", async () => {
	const shared = { tag: "x" };
	const value: Record<string, unknown> = {
		name: "Monti",
		count: 123n,
		run: () => "실행",
		first: shared,
		second: shared,
	};
	value.self = value;
	const toJsonLoop: { toJSON(): unknown } = {
		toJSON() {
			return { self: toJsonLoop };
		},
	};
	const response = successResponse(200, value);
	const fromToJson = successResponse(200, toJsonLoop);
	const fromFn = successResponse(200, () => "top");
	// HTTP-PRO-7.1
	expect([response.status, fromToJson.status, fromFn.status]).toEqual([200, 200, 200]);
	// HTTP-PRO-7.2
	expect(await response.json()).toEqual({ name: "Monti", count: "123", first: { tag: "x" }, second: { tag: "x" } });
	// HTTP-PRO-7.3
	expect([await fromToJson.json(), await fromFn.json()]).toEqual([{}, null]);
});

it("HTTP-PRO-8 코어 오류를 대응하는 HTTP 오류 상태(`400`, `401`, `403`, `404`, `409`)와 오류 JSON으로 바꾼다", async () => {
	const foreign = Object.assign(new Error("다른 경계 충돌"), { code: "CONFLICT" });
	const responses = [
		errorResponse(new MontiError("BAD_REQUEST", "잘못된 입력", { field: "slug" })),
		errorResponse(new MontiError("UNAUTHORIZED", "인증 필요")),
		errorResponse(new MontiError("FORBIDDEN", "권한 없음")),
		errorResponse(new MontiError("NOT_FOUND", "없음")),
		errorResponse(new MontiError("CONFLICT", "충돌")),
	];
	const converted = errorResponse(foreign);
	// HTTP-PRO-8.1
	expect(responses.map((response) => [response.status, response.headers.get("content-type")])).toEqual([
		[400, JSON_TYPE],
		[401, JSON_TYPE],
		[403, JSON_TYPE],
		[404, JSON_TYPE],
		[409, JSON_TYPE],
	]);
	// HTTP-PRO-8.2
	expect(await responses[0].json()).toEqual({
		error: { code: "BAD_REQUEST", message: "잘못된 입력", details: { field: "slug" } },
	});
	// HTTP-PRO-8.3
	expect(await responses[1].json()).toStrictEqual({ error: { code: "UNAUTHORIZED", message: "인증 필요" } });
	// HTTP-PRO-8.4
	expect([converted.status, await converted.json()]).toEqual([
		409,
		{ error: { code: "CONFLICT", message: "다른 경계 충돌" } },
	]);
});

it("HTTP-PRO-9 `Cookie` 헤더가 없거나 찾는 이름의 쿠키가 없으면 빈 결과를 돌려준다", () => {
	const values = [null, "", "other=1"].map((header) => readCookie(header, "monti_session"));
	// HTTP-PRO-9.1
	expect(values).toEqual([undefined, undefined, undefined]);
});

it("HTTP-PRO-10 잘못된 쿠키 옵션 조합이나 유효하지 않은 이름·경로·수명은 설정 오류로 거절한다", () => {
	const invalid = [
		{ sameSite: "none" as const, secure: false },
		{ name: "" },
		{ name: "a;b" },
		{ name: "a b" },
		{ path: "" },
		{ path: "/;x" },
		{ path: "/admin\r\nX-Injected: 1" },
		{ maxAge: 0 },
		{ maxAge: -1 },
		{ maxAge: 1.5 },
		{ maxAge: Number.NaN },
	];
	const errors = invalid.map((options) => {
		try {
			resolveCookie(options);
			return null;
		} catch (error) {
			return (error as Error).message;
		}
	});
	// HTTP-PRO-10.1
	expect(errors.every((message) => typeof message === "string" && message.includes("쿠키 설정이 잘못되었다"))).toBe(
		true,
	);
});

it("HTTP-PRO-11 코어 오류가 아닌 예기치 않은 오류나 직렬화 불가능한 오류도 내부 상세를 숨기고 서버 오류(`500`)로 바꾼다", async () => {
	const leaked = "db connection failed: internal detail";
	const responses = [errorResponse(new Error(leaked)), errorResponse("unexpected")];
	const texts = await Promise.all(responses.map((response) => response.text()));
	const results = responses.map((response, index) => [
		response.status,
		response.headers.get("content-type"),
		response.headers.get("cache-control"),
		JSON.parse(texts[index]).error.code,
	]);
	const unserializable = new MontiError("BAD_REQUEST", "실패", {
		toJSON() {
			throw new Error("boom");
		},
	});
	const weird = [
		errorResponse({ code: ["CONFLICT"], message: "배열 코드" }),
		errorResponse({ code: "NOT_FOUND" }),
		errorResponse(unserializable),
	];
	const weirdResults = await Promise.all(
		weird.map(async (response) => [
			response.status,
			response.headers.get("cache-control"),
			JSON.parse(await response.text()).error.code,
		]),
	);
	// HTTP-PRO-11.1
	expect(results).toEqual([
		[500, JSON_TYPE, "no-store", "INTERNAL_ERROR"],
		[500, JSON_TYPE, "no-store", "INTERNAL_ERROR"],
	]);
	// HTTP-PRO-11.2
	expect([texts[0].includes(leaked), texts[1].includes("unexpected")]).toEqual([false, false]);
	// HTTP-PRO-11.3
	expect(weirdResults).toEqual([
		[500, "no-store", "INTERNAL_ERROR"],
		[500, "no-store", "INTERNAL_ERROR"],
		[500, "no-store", "INTERNAL_ERROR"],
	]);
});

it("HTTP-PRO-12 열려 있지 않은 메서드로 호출하면 허용된 메서드 목록과 함께 거절한다(`405`)", async () => {
	const response = methodNotAllowedResponse(["GET", "POST"]);
	// HTTP-PRO-12.1
	expect([response.status, response.headers.get("allow"), response.headers.get("content-type")]).toEqual([
		405,
		"GET, POST",
		JSON_TYPE,
	]);
	// HTTP-PRO-12.2
	expect(JSON.parse(await response.text()).error.code).toBe("METHOD_NOT_ALLOWED");
});
