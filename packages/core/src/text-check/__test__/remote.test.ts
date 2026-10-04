import { afterEach, describe, expect, it, vi } from "vitest";
import { remoteTextChecker } from "../remote";
import { handleTextCheck, parseTextCheckBody } from "../server-handler";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const segments = [{ id: "a-0", text: "틀린말 입니다", locale: "ko" }];

describe("remoteTextChecker", () => {
	it("sends paragraphs as JSON and returns `{ issues }`", async () => {
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

	it("a failure response throws an error with the server's message", async () => {
		vi.stubGlobal("fetch", async () => Response.json({ code: "too_large", message: "Too much text" }, { status: 413 }));
		const checker = remoteTextChecker({ id: "remote", label: "원격", url: "/x" });
		await expect(checker.check(segments, { signal: new AbortController().signal })).rejects.toThrow("Too much text");
	});

	it("a response without `issues` is an error", async () => {
		vi.stubGlobal("fetch", async () => Response.json({ ok: true }));
		const checker = remoteTextChecker({ id: "remote", label: "원격", url: "/x" });
		await expect(checker.check(segments, { signal: new AbortController().signal })).rejects.toThrow();
	});
});

describe("server check route", () => {
	const signal = new AbortController().signal;

	it("an invalid body is 400, and exceeding the limit is 413", () => {
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

	it("drops results that name paragraphs not in the request or positions outside them", async () => {
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

	it("a checker error is returned as 502 without details", async () => {
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
