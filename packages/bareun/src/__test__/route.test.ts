// @vitest-environment node
import { AuthError } from "@monti-cms/core/adapters/auth";
import { createTranslator } from "@monti-cms/core/client";
import { fakeCms } from "@monti-cms/core/testing";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bareunMessages } from "../messages";
import { resolveBareunOptions } from "../options";
import { bareunRoute } from "../route";
import bareunServer from "../server";
import sample from "./fixtures/bareun-sample.json";

const mockVerifyAdmin = vi.fn();

const cms = fakeCms({ verifyAdmin: () => mockVerifyAdmin() });

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
		{ cms },
	);

describe("Bareun check route", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("mounts the route on the server route table using the site config values", () => {
		expect(bareunServer.routes?.map((route) => route.pattern)).toEqual(["v1/text-check/bareun"]);
	});

	it("joins paragraphs, sends them to Bareun with UTF-16 positions, and returns per-paragraph results", async () => {
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
			// Non-Korean paragraphs are not sent.
			document: { content: sample.request, language: "ko_KR" },
			encodingType: "UTF16",
			customDictNames: ["blog"],
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("without a key it does not call Bareun and returns 503", async () => {
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

	it("rejects non-admins first, even without a key", async () => {
		vi.stubEnv(KEY_ENV, "");
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "no"));
		const res = await post({ segments });
		expect(res.status).not.toBe(200);
		expect(res.status).not.toBe(503);
	});

	it("returns Bareun errors as a generic error without the key or response body", async () => {
		vi.stubEnv(KEY_ENV, FAKE_KEY);
		vi.stubGlobal("fetch", async () => new Response(`invalid api-key ${FAKE_KEY}`, { status: 401 }));
		const res = await post({ segments });
		expect(res.status).toBe(502);
		const text = await res.text();
		expect(JSON.parse(text)).toEqual({ code: "text_check_failed", message: "Text check failed" });
		expect(text).not.toContain(FAKE_KEY);
	});

	it("does not call Bareun for empty text", async () => {
		vi.stubEnv(KEY_ENV, FAKE_KEY);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const res = await post({ segments: [{ id: "a", text: "  ", locale: "ko" }] });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ issues: [] });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
