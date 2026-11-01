import { afterEach, describe, expect, it, vi } from "vitest";
import { remoteTextChecker } from "../remote";
import { handleTextCheck, parseTextCheckBody } from "../server-handler";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const segments = [{ id: "a-0", text: "틀린말 입니다", locale: "ko" }];

describe("remoteTextChecker", () => {
	it("PLUG-T2 sends paragraphs as JSON and returns `{ issues }`", async () => {
		const issues = [
			{ segmentId: "a-0", start: 0, end: 3, message: "틀림", suggestions: ["맞는말"], severity: "error" },
		];
		const fetchMock = vi.fn(async () => Response.json({ issues }));
		vi.stubGlobal("fetch", fetchMock);
		const checker = remoteTextChecker({ id: "remote", label: "원격", url: "/api/text-check" });
		const signal = new AbortController().signal;

		await expect(checker.check(segments, { signal })).resolves.toEqual(issues);
		expect(checker.auto).toBe(false);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/text-check",
			expect.objectContaining({
				method: "POST",
				signal,
				credentials: "same-origin",
				headers: expect.objectContaining({ "content-type": "application/json" }),
				body: JSON.stringify({ segments }),
			}),
		);
	});

	it("PLUG-T4 a failure response throws an error with the server's message", async () => {
		vi.stubGlobal("fetch", async () =>
			Response.json({ error: { code: "payload_too_large", message: "Too much text" } }, { status: 413 }),
		);
		const checker = remoteTextChecker({ id: "remote", label: "원격", url: "/x" });
		await expect(checker.check(segments, { signal: new AbortController().signal })).rejects.toThrow("Too much text");
	});
});

describe("server check route", () => {
	const signal = new AbortController().signal;

	it("PLUG-T5 an invalid body is 400, and exceeding the limit is 413", () => {
		expect(() => parseTextCheckBody({})).toThrow(expect.objectContaining({ code: "invalid_input" }));
		expect(() => parseTextCheckBody({ segments: [{ id: "a", text: 1, locale: "ko" }] })).toThrow(
			expect.objectContaining({ code: "invalid_input" }),
		);
		expect(() =>
			parseTextCheckBody({
				segments: [
					{ id: "a", text: "x", locale: "ko" },
					{ id: "a", text: "y", locale: "ko" },
				],
			}),
		).toThrow(expect.objectContaining({ code: "invalid_input" }));
		expect(() => parseTextCheckBody({ segments }, { maxChars: 3 })).toThrow(
			expect.objectContaining({ code: "payload_too_large" }),
		);
		expect(parseTextCheckBody({ segments }, { maxSegments: 1 })).toEqual(segments);
	});

	it("PLUG-T2 drops results that name paragraphs not in the request or positions outside them", async () => {
		const check = vi.fn(async () => [
			{ segmentId: "a-0", start: 0, end: 3, message: "틀림", suggestions: ["맞는말"], severity: "error" as const },
			{ segmentId: "other", start: 0, end: 1, message: "x", suggestions: [], severity: "info" as const },
			{ segmentId: "a-0", start: 0, end: 99, message: "x", suggestions: [], severity: "info" as const },
		]);
		const result = await handleTextCheck({ segments }, { check }, signal);
		expect(check).toHaveBeenCalledWith(segments, { signal });
		expect(result).toEqual({
			issues: [{ segmentId: "a-0", start: 0, end: 3, message: "틀림", suggestions: ["맞는말"], severity: "error" }],
		});
	});

	it("PLUG-T4 a checker error is a 502 upstream_failed without details", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			handleTextCheck(
				{ segments },
				{
					check: async () => {
						throw new Error("key=secret");
					},
				},
				signal,
			),
		).rejects.toMatchObject({ code: "upstream_failed", message: "Text check failed" });
	});
});
