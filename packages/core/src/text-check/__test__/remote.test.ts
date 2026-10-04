import { afterEach, describe, expect, it, vi } from "vitest";
import { remoteTextChecker } from "../remote";
import { handleTextCheck, parseTextCheckBody } from "../server-handler";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const segments = [{ id: "a-0", text: "틀린말 입니다", locale: "ko" }];

describe("remoteTextChecker", () => {
	it("문단을 JSON으로 보내고 `{ issues }`를 돌려준다", async () => {
		const issues = [
			{ segmentId: "a-0", start: 0, end: 3, message: "틀림", suggestions: ["맞는말"], severity: "error" },
		];
		const fetchMock = vi.fn(async () => Response.json({ issues }));
		vi.stubGlobal("fetch", fetchMock);
		const checker = remoteTextChecker({ id: "remote", label: "원격", url: "/api/text-check" });
		const signal = new AbortController().signal;

		await expect(checker.check(segments, { signal })).resolves.toEqual(issues);
		expect(checker.auto).toBe(false);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("/api/text-check");
		expect(init.method).toBe("POST");
		expect(init.signal).toBe(signal);
		expect(init.credentials).toBe("same-origin");
		expect(new Headers(init.headers).get("content-type")).toBe("application/json");
		expect(JSON.parse(String(init.body))).toEqual({ segments });
	});

	it("실패 응답은 서버 문구로 오류를 던진다", async () => {
		vi.stubGlobal("fetch", async () => Response.json({ code: "too_large", message: "Too much text" }, { status: 413 }));
		const checker = remoteTextChecker({ id: "remote", label: "원격", url: "/x" });
		await expect(checker.check(segments, { signal: new AbortController().signal })).rejects.toThrow("Too much text");
	});

	it("`issues`가 없는 응답은 오류다", async () => {
		vi.stubGlobal("fetch", async () => Response.json({ ok: true }));
		const checker = remoteTextChecker({ id: "remote", label: "원격", url: "/x" });
		await expect(checker.check(segments, { signal: new AbortController().signal })).rejects.toThrow();
	});
});

describe("서버 검사 경로", () => {
	const signal = new AbortController().signal;

	it("잘못된 본문은 400, 한도를 넘으면 413이다", () => {
		expect(parseTextCheckBody({})).toMatchObject({ status: 400 });
		expect(parseTextCheckBody({ segments: [{ id: "a", text: 1, locale: "ko" }] })).toMatchObject({ status: 400 });
		expect(
			parseTextCheckBody({
				segments: [
					{ id: "a", text: "x", locale: "ko" },
					{ id: "a", text: "y", locale: "ko" },
				],
			}),
		).toMatchObject({ status: 400 });
		expect(parseTextCheckBody({ segments }, { maxChars: 3 })).toMatchObject({ status: 413 });
		expect(parseTextCheckBody({ segments }, { maxSegments: 1 })).toEqual(segments);
	});

	it("검사기 결과 중 요청에 없는 문단·벗어난 위치는 뺀다", async () => {
		const check = vi.fn(async () => [
			{ segmentId: "a-0", start: 0, end: 3, message: "틀림", suggestions: ["맞는말"], severity: "error" as const },
			{ segmentId: "other", start: 0, end: 1, message: "x", suggestions: [], severity: "info" as const },
			{ segmentId: "a-0", start: 0, end: 99, message: "x", suggestions: [], severity: "info" as const },
		]);
		const result = await handleTextCheck({ segments }, { check }, signal);
		expect(check).toHaveBeenCalledWith(segments, { signal });
		expect(result).toEqual({
			status: 200,
			body: {
				issues: [{ segmentId: "a-0", start: 0, end: 3, message: "틀림", suggestions: ["맞는말"], severity: "error" }],
			},
		});
	});

	it("검사기 오류는 자세한 내용 없이 502로 돌려준다", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await handleTextCheck(
			{ segments },
			{
				check: async () => {
					throw new Error("key=secret");
				},
			},
			signal,
		);
		expect(result).toEqual({ status: 502, body: { code: "text_check_failed", message: "Text check failed" } });
	});
});
