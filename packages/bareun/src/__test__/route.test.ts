// @vitest-environment node

import { defineSite } from "@monti-cms/core";
import { AuthError } from "@monti-cms/core/adapters/auth";
import { type Cms, CmsError, type PluginStorage } from "@monti-cms/core/plugin/server";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../test/site";
import { bareun } from "../index";
import { bareunMessages } from "../messages";
import type { BareunOptions } from "../options";
import { bareunRoute } from "../route";
import bareunServer from "../server";
import { saveSettings } from "../settings";
import { settingsRoute } from "../settings-route";
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
const getSettings = (cms: Cms) => settingsRoute.GET(request("GET"), { cms });
const putSettings = (cms: Cms, key: unknown) => settingsRoute.PUT(request("PUT", { key }), { cms });

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

	it("mounts the check and settings routes on the server route table", () => {
		const patterns = bareunServer.routes?.map((route) => route.pattern) ?? [];
		expect(patterns).toContain("v1/text-check/bareun");
		expect(patterns).toContain("v1/text-check/bareun/settings");
	});

	it("joins paragraphs, sends them to Bareun with the stored key and UTF-16 positions, and returns per-paragraph results", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json(sample.response));
		vi.stubGlobal("fetch", fetchMock);
		const cms = cmsWith({ baseUrl: "https://bareun.example/", customDictNames: ["blog"] });
		expect((await putSettings(cms, { use: "new", value: FAKE_KEY })).status).toBe(200);

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

	it("returns 503 again once the key is deleted from the store", async () => {
		vi.stubGlobal("fetch", async () => Response.json(sample.response));
		const cms = cmsWith();
		await putSettings(cms, { use: "new", value: FAKE_KEY });
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
		await putSettings(cms, { use: "new", value: FAKE_KEY });
		const res = await post({ segments }, cms);
		expect(res.status).toBe(502);
		const text = await res.text();
		expect(JSON.parse(text)).toEqual({ code: "text_check_failed", message: "Text check failed" });
		expect(text).not.toContain(FAKE_KEY);
	});

	it("does not call Bareun for empty text", async () => {
		const cms = cmsWith();
		await putSettings(cms, { use: "new", value: FAKE_KEY });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const res = await post({ segments: [{ id: "a", text: "  ", locale: "ko" }] }, cms);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ issues: [] });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("Bareun settings route", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
	});
	afterEach(() => vi.restoreAllMocks());

	it("starts with no key, and saving a typed key never returns its value", async () => {
		const cms = cmsWith();
		expect(await (await getSettings(cms)).json()).toEqual({ key: null });

		const res = await putSettings(cms, { use: "new", value: FAKE_KEY });
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).not.toContain(FAKE_KEY);
		const { key } = JSON.parse(text) as { key: { id: string; name: string; tail: string; readable: boolean } };
		expect(key).toMatchObject({ name: "Bareun", tail: FAKE_KEY.slice(-4), readable: true });

		const read = await (await getSettings(cms)).text();
		expect(read).not.toContain(FAKE_KEY);
		expect(JSON.parse(read)).toEqual({ key });
		// The store tells where the key is used.
		const [stored] = await cms.apiKeys.list();
		expect(stored?.uses).toEqual([
			{ plugin: "text-check-bareun", slot: "key", label: testSite.createTranslator(bareunMessages)("keyUse") },
		]);
	});

	it("names a second typed key after the first, and choosing no key forgets where it was used", async () => {
		const cms = cmsWith();
		await putSettings(cms, { use: "new", value: FAKE_KEY });
		const second = await (await putSettings(cms, { use: "new", value: `${FAKE_KEY}-second` })).json();
		expect(second.key.name).toBe("Bareun 2");

		expect(await (await putSettings(cms, { use: "none" })).json()).toEqual({ key: null });
		const keys = await cms.apiKeys.list();
		expect(keys.map((key) => key.name).sort()).toEqual(["Bareun", "Bareun 2"]);
		expect(keys.flatMap((key) => key.uses)).toEqual([]);
	});

	it("can switch to a saved key, and rejects a key that does not exist", async () => {
		const cms = cmsWith();
		const saved = await cms.apiKeys.add({ name: "Shared", value: FAKE_KEY });
		const res = await putSettings(cms, { use: "saved", keyId: saved.id });
		expect((await res.json()).key).toMatchObject({ id: saved.id, name: "Shared" });
		expect((await putSettings(cms, { use: "saved", keyId: "missing" })).status).toBeGreaterThanOrEqual(400);
		expect((await putSettings(cms, { use: "bogus" })).status).toBe(400);
	});

	it("is for admins only", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "no"));
		expect((await getSettings(cmsWith())).status).not.toBe(200);
		expect((await putSettings(cmsWith(), { use: "none" })).status).not.toBe(200);
	});

	it("removes a key it just created when the settings cannot be saved", async () => {
		const cms = cmsWith();
		const failing: Cms = {
			...cms,
			storage: (plugin) => {
				const storage = cms.storage(plugin);
				return {
					...storage,
					collection: (name) => {
						const collection = storage.collection(name);
						return name === "settings"
							? {
									...collection,
									set: async () => {
										throw new CmsError("stale", "conflict");
									},
								}
							: collection;
					},
				} as PluginStorage;
			},
		};
		await expect(saveSettings(failing, { use: "new", value: FAKE_KEY })).rejects.toMatchObject({ code: "conflict" });
		expect(await cms.apiKeys.list()).toEqual([]);
	});
});
