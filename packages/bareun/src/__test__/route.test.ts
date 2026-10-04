// @vitest-environment node
import { createTranslator } from "@monti-cms/core/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bareunMessages } from "../messages";
import { resolveBareunOptions } from "../options";
import { bareunRoute } from "../route";
import bareunServer from "../server";
import sample from "./fixtures/bareun-sample.json";

const mockVerifyAdmin = vi.fn();

vi.mock("@monti-cms/core/adapters/auth", () => ({
	authGateway: { verifyAdmin: () => mockVerifyAdmin() },
	AuthError: class AuthError extends Error {
		constructor(
			public code: string,
			message: string,
		) {
			super(message);
		}
	},
}));

const KEY_ENV = "TEST_BAREUN_KEY";
const FAKE_KEY = "test-key-123";
const segments = sample.request.split("\n").map((text, index) => ({ id: `p-${index}`, text, locale: "ko" }));

const post = (body: unknown, options = resolveBareunOptions({ apiKeyEnv: KEY_ENV })) =>
	bareunRoute(options).POST(
		new NextRequest("http://localhost/api/cms/v1/text-check/bareun", {
			method: "POST",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

describe("바른 검사 경로", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("서버 쪽 경로표에 사이트 설정의 값으로 경로를 단다", () => {
		expect(bareunServer.routes?.map((route) => route.pattern)).toEqual(["v1/text-check/bareun"]);
	});

	it("문단을 이어 UTF16 위치로 바른에 보내고 문단별 결과를 돌려준다", async () => {
		vi.stubEnv(KEY_ENV, FAKE_KEY);
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json(sample.response));
		vi.stubGlobal("fetch", fetchMock);

		const res = await post(
			{ segments: [...segments, { id: "en", text: "Hello", locale: "en" }] },
			resolveBareunOptions({ apiKeyEnv: KEY_ENV, baseUrl: "https://bareun.example/", customDictNames: ["blog"] }),
		);
		expect(res.status).toBe(200);
		const { issues } = (await res.json()) as { issues: { segmentId: string; start: number; end: number }[] };
		expect(issues.map(({ segmentId, start, end }) => [segmentId, start, end])).toEqual([
			["p-0", 12, 17],
			["p-1", 0, 6],
			["p-1", 3, 8],
			["p-2", 10, 15],
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("https://bareun.example/bareun.RevisionService/CorrectError");
		expect(init?.method).toBe("POST");
		const headers = new Headers(init?.headers);
		expect(headers.get("content-type")).toBe("application/json");
		expect(headers.get("api-key")).toBe(FAKE_KEY);
		expect(headers.get("connect-protocol-version")).toBe("1");
		expect(JSON.parse(String(init?.body))).toEqual({
			// 한국어가 아닌 문단은 보내지 않는다.
			document: { content: sample.request, language: "ko_KR" },
			encodingType: "UTF16",
			customDictNames: ["blog"],
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("키가 없으면 바른을 부르지 않고 503이다", async () => {
		vi.stubEnv(KEY_ENV, "");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const res = await post({ segments });
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			code: "text_check_unavailable",
			message: createTranslator(bareunMessages)("error.keyMissing"),
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("관리자가 아니면 키가 없어도 먼저 막는다", async () => {
		vi.stubEnv(KEY_ENV, "");
		mockVerifyAdmin.mockRejectedValue(Object.assign(new Error("no"), { code: "unauthorized" }));
		const res = await post({ segments });
		expect(res.status).not.toBe(200);
		expect(res.status).not.toBe(503);
	});

	it("바른 오류는 키·응답 본문 없이 일반 오류로 돌려준다", async () => {
		vi.stubEnv(KEY_ENV, FAKE_KEY);
		vi.stubGlobal("fetch", async () => new Response(`invalid api-key ${FAKE_KEY}`, { status: 401 }));
		const res = await post({ segments });
		expect(res.status).toBe(502);
		const text = await res.text();
		expect(JSON.parse(text)).toEqual({ code: "text_check_failed", message: "Text check failed" });
		expect(text).not.toContain(FAKE_KEY);
	});

	it("빈 글은 바른을 부르지 않는다", async () => {
		vi.stubEnv(KEY_ENV, FAKE_KEY);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const res = await post({ segments: [{ id: "a", text: "  ", locale: "ko" }] });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ issues: [] });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
