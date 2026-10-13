// @vitest-environment node

import { createActiveTranslator, defineSite } from "@monti-cms/core";
import { AuthError } from "@monti-cms/core/adapters/auth";
import type { Cms } from "@monti-cms/core/plugin/server";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../test/site";
import { bareun } from "../index";
import { bareunMessages } from "../messages";
import type { BareunOptions } from "../options";
import { bareunRoute } from "../route";
import bareunServer from "../server";
import sample from "./fixtures/bareun-sample.json";

const mockVerifyAdmin = vi.fn();

const FAKE_KEY = "test-key-123456789";
const segments = sample.request.split("\n").map((text, index) => ({ id: `p-${index}`, text, locale: "ko" }));

// The route reads its settings from the Bareun plugin of the instance that serves the request.
const cmsWith = (options: BareunOptions = {}, secret = "test-secret-for-bareun") =>
	fakeCms({
		config: defineSite({ ...testConfig, plugins: [bareun(options)] }),
		verifyAdmin: () => mockVerifyAdmin(),
		server: secret ? { secret } : {},
	});

const request = (method: string, body?: unknown) =>
	new Request("http://localhost/api/monti/v1/text-check/bareun", {
		method,
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});

const post = (body: unknown, cms: Cms = cmsWith()) => bareunRoute().POST(request("POST", body), { cms });
const assignKey = (cms: Cms, value: string) =>
	cms.apiKeys.assignSlot("text-check-bareun", "key", { use: "new", value }, { baseName: "Bareun" });

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

	it("mounts the check route on the server route table and no settings route", () => {
		expect(bareunServer.routes?.map((route) => route.pattern)).toEqual(["v1/text-check/bareun"]);
	});

	it("joins paragraphs, sends them to Bareun with the key in the slot and UTF-16 positions, and returns per-paragraph results", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json(sample.response));
		vi.stubGlobal("fetch", fetchMock);
		const cms = cmsWith({ baseUrl: "https://bareun.example/", customDictNames: ["blog"] });
		await assignKey(cms, FAKE_KEY);

		const res = await post({ segments: [...segments, { id: "en", text: "Hello", locale: "en" }] }, cms);
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

	it("without a key it does not call Bareun and returns 503, even when the old environment variable is set", async () => {
		vi.stubEnv("BAREUN_API_KEY", FAKE_KEY);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const res = await post({ segments });
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			code: "text_check_unavailable",
			message: testSite.createTranslator(bareunMessages)("error.keyMissing"),
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns 503 again once the slot is cleared", async () => {
		vi.stubGlobal("fetch", async () => Response.json(sample.response));
		const cms = cmsWith();
		await assignKey(cms, FAKE_KEY);
		expect((await post({ segments }, cms)).status).toBe(200);
		await cms.apiKeys.setSlot("text-check-bareun", "key", null);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		expect((await post({ segments }, cms)).status).toBe(503);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns 503 again once the assigned key is deleted from the store", async () => {
		vi.stubGlobal("fetch", async () => Response.json(sample.response));
		const cms = cmsWith();
		await assignKey(cms, FAKE_KEY);
		expect((await post({ segments }, cms)).status).toBe(200);

		const [key] = await cms.apiKeys.list();
		expect(key).toBeDefined();
		if (!key) return;
		await cms.apiKeys.remove(key.id, { expectedVersion: key.version });

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		expect((await post({ segments }, cms)).status).toBe(503);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects non-admins first, even without a key", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "no"));
		const res = await post({ segments });
		expect(res.status).not.toBe(200);
		expect(res.status).not.toBe(503);
	});

	it("returns Bareun errors as a generic error without the key or response body", async () => {
		vi.stubGlobal("fetch", async () => new Response(`invalid api-key ${FAKE_KEY}`, { status: 401 }));
		const cms = cmsWith();
		await assignKey(cms, FAKE_KEY);
		const res = await post({ segments }, cms);
		expect(res.status).toBe(502);
		const text = await res.text();
		expect(JSON.parse(text)).toEqual({ code: "text_check_failed", message: "Text check failed" });
		expect(text).not.toContain(FAKE_KEY);
	});

	it("does not call Bareun for empty text", async () => {
		const cms = cmsWith();
		await assignKey(cms, FAKE_KEY);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const res = await post({ segments: [{ id: "a", text: "  ", locale: "ko" }] }, cms);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ issues: [] });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("Bareun key slot", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("declares exactly one slot, labelled in the admin language of the site", async () => {
		const cms = cmsWith();
		const slots = await cms.apiKeys.slots();
		expect(slots).toHaveLength(1);
		expect(slots[0]).toMatchObject({ plugin: "text-check-bareun", slot: "key", service: "Bareun", key: null });
		expect(slots[0]?.label).toBe(cms.site.createTranslator(bareunMessages)("keyLabel"));
		expect(bareun().keySlots).toHaveLength(1);
	});

	it("is not listed when the plugin is not in the site config", async () => {
		const cms = fakeCms({
			config: defineSite({ ...testConfig, plugins: [] }),
			server: { secret: "test-secret-for-bareun" },
		});
		expect(await cms.apiKeys.slots()).toEqual([]);
	});
});
