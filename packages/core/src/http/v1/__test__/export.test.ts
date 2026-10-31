import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	FIXTURE_CONTENT_COLLECTION,
	FIXTURE_DRAFT_COLLECTION,
	fixtureEntryPath,
	makeExportFixtureSnapshot,
} from "../../../../test/export-fixture";
import { paragraphsFormat } from "../../../../test/paragraphs-format";
import { testConfig } from "../../../../test/site";
import { AuthError } from "../../../adapters/auth";
import { fakeCms } from "../../../cms";
import { STORED_DOCUMENT_VERSION } from "../../../doc/stored-document";
import { defineFormat } from "../../../format/types";
import { EXPORT_FORMAT_VERSION } from "../../../services/export-service";
import { readZipArchive } from "../../../services/zip";
import { routeCaller } from "../../../testing";
import { GET as GETHandler, POST as POSTHandler } from "../export/route";
import { GET as SUMMARY_GET, POST as SUMMARY_POST } from "../export/summary/route";

const GET = routeCaller(GETHandler);
const POST = routeCaller(POSTHandler);
const SUMMARY = routeCaller(SUMMARY_GET);
const SUMMARY_BY_POST = routeCaller(SUMMARY_POST);

const mockVerifyAdmin = vi.fn();
const mockReadExportSnapshot = vi.fn();

const cms = fakeCms({
	config: testConfig,
	store: { readExportSnapshot: () => mockReadExportSnapshot() },
	verifyAdmin: () => mockVerifyAdmin(),
	formats: [
		paragraphsFormat,
		// A format that cannot write one of the bodies (the draft's).
		defineFormat({
			...paragraphsFormat,
			name: "flaky",
			extension: "flk",
			export: (document, context) => {
				const text = paragraphsFormat.export(document, context);
				if (String(text).includes("draft secret")) throw new Error("cannot write this one");
				return text;
			},
		}),
	],
});

const decoder = new TextDecoder();
/** Working files of the fixture draft (a memo in the reference blog setup, otherwise that config's collection). */
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const DRAFT_WORKING = fixtureEntryPath(FIXTURE_DRAFT_COLLECTION, DRAFT_ID, "working.doc.json");
const DRAFT_WORKING_TEXT = fixtureEntryPath(FIXTURE_DRAFT_COLLECTION, DRAFT_ID, "working.txt");

const PUBLISHED_WORKING_DOC = fixtureEntryPath(
	FIXTURE_CONTENT_COLLECTION,
	"11111111-1111-4111-8111-111111111111",
	"working.doc.json",
);

const request = (url: string, init?: RequestInit) => new Request(url, init);

const findFile = (zip: Uint8Array, path: string): string => {
	const entry = readZipArchive(zip).find((item) => item.path === path);
	if (!entry) throw new Error(`missing ${path}`);
	return decoder.decode(entry.data);
};

describe("GET/POST /api/monti/v1/export", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
		mockReadExportSnapshot.mockResolvedValue(makeExportFixtureSnapshot());
	});

	it("DATA-B6 returns 401 for an unauthenticated request", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Session required"));
		const res = await GET(request("http://localhost/api/monti/v1/export"), { cms });
		expect(res.status).toBe(401);
		expect((await res.json()).error.code).toBe("unauthorized");
	});

	it("DATA-B4 returns 400 for an invalid scope", async () => {
		const res = await GET(request("http://localhost/api/monti/v1/export?scope=everything"), { cms });
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("invalid_input");
	});

	it("DATA-B1 default (admin) export returns a ZIP with a digest header and includes draft bodies", async () => {
		const res = await GET(request("http://localhost/api/monti/v1/export"), { cms });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/zip");
		expect(res.headers.get("content-disposition")).toContain("monti-export-admin-");
		expect(res.headers.get("x-monti-export-digest")).toMatch(/^[0-9a-f]{64}$/);

		const zip = new Uint8Array(await res.arrayBuffer());
		const manifest = JSON.parse(findFile(zip, "manifest.json"));
		expect(manifest.scope).toBe("admin");
		expect(manifest.formatVersion).toBe(EXPORT_FORMAT_VERSION);
		expect(manifest.format).toBeNull();
		expect(manifest.counts.entries).toBe(3);
		expect(findFile(zip, DRAFT_WORKING)).toContain("draft secret body");
		// Without a format the archive holds the documents only.
		expect(readZipArchive(zip).some((item) => item.path.endsWith(".txt"))).toBe(false);
		expect(JSON.parse(findFile(zip, PUBLISHED_WORKING_DOC))).toMatchObject({
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
		});
	});

	it("DATA-B5 an export with ?format= also writes every body as text in that format", async () => {
		const res = await GET(request("http://localhost/api/monti/v1/export?format=paragraphs"), { cms });
		expect(res.status).toBe(200);

		const zip = new Uint8Array(await res.arrayBuffer());
		const manifest = JSON.parse(findFile(zip, "manifest.json"));
		expect(manifest.format).toEqual({ name: "paragraphs", extension: "txt" });
		expect(findFile(zip, DRAFT_WORKING_TEXT)).toBe("draft secret body");
		expect(findFile(zip, DRAFT_WORKING)).toContain("draft secret body");
		const templates = JSON.parse(findFile(zip, "templates.json"));
		expect(templates[0].body).toBe("문제");
		expect(manifest.files).toContain(DRAFT_WORKING_TEXT);
	});

	it("DATA-B3 a public export with a format holds the published text only, with no draft text in it", async () => {
		const res = await POST(
			request("http://localhost/api/monti/v1/export", {
				method: "POST",
				headers: { origin: "http://localhost", "content-type": "application/json", host: "localhost" },
				body: JSON.stringify({ scope: "public", format: "paragraphs" }),
			}),
			{ cms },
		);
		expect(res.status).toBe(200);

		const zip = new Uint8Array(await res.arrayBuffer());
		const paths = readZipArchive(zip).map((entry) => entry.path);
		expect(paths).toContain(
			fixtureEntryPath(FIXTURE_CONTENT_COLLECTION, "11111111-1111-4111-8111-111111111111", "published.txt"),
		);
		expect(paths.some((path) => path.endsWith("working.txt"))).toBe(false);
		expect(decoder.decode(zip)).not.toContain("draft secret body");
	});

	it("DATA-B5 an export in a format nobody provides is a 400 unknown_format, and no archive", async () => {
		const res = await GET(request("http://localhost/api/monti/v1/export?format=hugo"), { cms });
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("unknown_format");

		const bad = await GET(request("http://localhost/api/monti/v1/export?format=Not%20A%20Name"), { cms });
		expect(bad.status).toBe(400);
		expect((await bad.json()).error.code).toBe("invalid_input");
	});

	it("DATA-B3 public export excludes drafts and does not include working values", async () => {
		const res = await GET(request("http://localhost/api/monti/v1/export?scope=public"), { cms });
		expect(res.status).toBe(200);
		expect(res.headers.get("x-monti-export-scope")).toBe("public");

		const zip = new Uint8Array(await res.arrayBuffer());
		const paths = readZipArchive(zip).map((entry) => entry.path);
		expect(paths).not.toContain(DRAFT_WORKING);
		expect(paths.some((path) => path.endsWith(".doc.json"))).toBe(false);
		expect(paths.some((path) => path.includes("11111111-1111-4111-8111-111111111111"))).toBe(true);

		for (const path of paths.filter((item) => item.endsWith(".json"))) {
			expect(findFile(zip, path)).not.toContain('"working"');
		}
		expect(decoder.decode(zip)).not.toContain("draft secret body");
	});

	it("DATA-B6 POST blocks cross-origin requests with 403", async () => {
		const res = await POST(
			request("http://localhost/api/monti/v1/export", {
				method: "POST",
				headers: { origin: "http://attacker.com", "content-type": "application/json", host: "localhost" },
				body: JSON.stringify({ scope: "public" }),
			}),
			{ cms },
		);
		expect(res.status).toBe(403);
	});

	it("DATA-B1 POST accepts scope from the same origin and creates an archive", async () => {
		const res = await POST(
			request("http://localhost/api/monti/v1/export", {
				method: "POST",
				headers: { origin: "http://localhost", "content-type": "application/json", host: "localhost" },
				body: JSON.stringify({ scope: "public" }),
			}),
			{ cms },
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("x-monti-export-scope")).toBe("public");
	});

	it("DATA-B6 maps a store error to 500 and does not expose the digest header", async () => {
		mockReadExportSnapshot.mockRejectedValue(new Error("db down"));
		const res = await GET(request("http://localhost/api/monti/v1/export"), { cms });
		expect(res.status).toBe(500);
		expect(res.headers.get("x-monti-export-digest")).toBeNull();
	});

	describe("a selection (ids)", () => {
		const POST_ID = "11111111-1111-4111-8111-111111111111";
		const DRAFT = "22222222-2222-4222-8222-222222222222";
		const post = (body: unknown) =>
			POST(
				request("http://localhost/api/monti/v1/export", {
					method: "POST",
					headers: { origin: "http://localhost", "content-type": "application/json", host: "localhost" },
					body: JSON.stringify(body),
				}),
				{ cms },
			);

		it("DATA-B4 limits the archive to those entries (a comma list in the query), templates and preferences left out", async () => {
			const res = await GET(request(`http://localhost/api/monti/v1/export?ids=${POST_ID}`), { cms });
			expect(res.status).toBe(200);

			const zip = new Uint8Array(await res.arrayBuffer());
			const manifest = JSON.parse(findFile(zip, "manifest.json"));
			expect(manifest.selection).toEqual({ ids: [POST_ID] });
			expect(manifest.entries.map((entry: { id: string }) => entry.id)).toEqual([POST_ID]);
			expect(manifest.counts).toMatchObject({ entries: 1, templates: 0, preferences: 0 });
			expect(decoder.decode(zip)).not.toContain("draft secret body");
		});

		it("DATA-B4 takes an array in a POST body, and with the public scope holds published members only", async () => {
			const res = await post({ ids: [POST_ID, DRAFT], scope: "public" });
			expect(res.status).toBe(200);

			const manifest = JSON.parse(findFile(new Uint8Array(await res.arrayBuffer()), "manifest.json"));
			expect(manifest.selection).toEqual({ ids: [POST_ID, DRAFT] });
			expect(manifest.entries.map((entry: { id: string }) => entry.id)).toEqual([POST_ID]);
		});

		it("DATA-B4 rejects ids that are empty or not IDs", async () => {
			for (const ids of ["", "not-an-id", `${POST_ID},nope`]) {
				const res = await GET(request(`http://localhost/api/monti/v1/export?ids=${ids}`), { cms });
				expect(res.status, ids).toBe(400);
			}
			expect((await post({ ids: [] })).status).toBe(400);
		});

		it("DATA-B4 a whole-site export records no selection", async () => {
			const res = await GET(request("http://localhost/api/monti/v1/export"), { cms });
			const manifest = JSON.parse(findFile(new Uint8Array(await res.arrayBuffer()), "manifest.json"));
			expect(manifest.selection).toBeNull();
		});
	});

	describe("a body the format cannot write", () => {
		it("DATA-B5 keeps the body's JSON, skips its text, records it, and still exports the rest", async () => {
			const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
			const res = await GET(request("http://localhost/api/monti/v1/export?format=flaky"), { cms });
			quiet.mockRestore();
			expect(res.status).toBe(200);
			expect(res.headers.get("x-monti-export-not-written")).toBe("1");

			const zip = new Uint8Array(await res.arrayBuffer());
			const manifest = JSON.parse(findFile(zip, "manifest.json"));
			expect(manifest.notWritten).toEqual([{ id: DRAFT_ID, state: "working", reason: expect.any(String) }]);
			const paths = readZipArchive(zip).map((entry) => entry.path);
			const draftText = fixtureEntryPath(FIXTURE_DRAFT_COLLECTION, DRAFT_ID, "working.flk");
			expect(paths).toContain(DRAFT_WORKING);
			expect(paths).not.toContain(draftText);
			expect(manifest.files).not.toContain(draftText);
			// The other bodies were written.
			expect(paths).toContain(
				fixtureEntryPath(FIXTURE_CONTENT_COLLECTION, "11111111-1111-4111-8111-111111111111", "working.flk"),
			);
			// The error's detail does not reach the archive.
			expect(decoder.decode(zip)).not.toContain("cannot write this one");
		});

		it("DATA-B5 an export where every body was written says 0 and lists nothing", async () => {
			const res = await GET(request("http://localhost/api/monti/v1/export?format=paragraphs"), { cms });
			expect(res.headers.get("x-monti-export-not-written")).toBe("0");
			const manifest = JSON.parse(findFile(new Uint8Array(await res.arrayBuffer()), "manifest.json"));
			expect(manifest.notWritten).toEqual([]);
		});
	});
});

describe("GET/POST /api/monti/v1/export/summary", () => {
	const POST_ID = "11111111-1111-4111-8111-111111111111";
	const DRAFT = "22222222-2222-4222-8222-222222222222";
	const base = "http://localhost/api/monti/v1/export/summary";

	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
		mockReadExportSnapshot.mockResolvedValue(makeExportFixtureSnapshot());
	});

	it("DATA-B6 is admin-only", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Session required"));
		expect((await SUMMARY(request(base), { cms })).status).toBe(401);
	});

	it("DATA-B4 counts what the export would hold, and agrees with the archive's manifest", async () => {
		const summary = await (await SUMMARY(request(base), { cms })).json();
		const archive = await GET(request("http://localhost/api/monti/v1/export"), { cms });
		const manifest = JSON.parse(findFile(new Uint8Array(await archive.arrayBuffer()), "manifest.json"));

		expect(summary).toMatchObject({
			scope: "admin",
			entries: manifest.counts.entries,
			templates: manifest.counts.templates,
			folders: manifest.counts.folders,
			addresses: manifest.counts.addresses,
			media: manifest.counts.media,
			addedByTranslations: 0,
		});
	});

	it("DATA-B4 takes scope, ids and format like the export, and public counts the entries it leaves out", async () => {
		const res = await SUMMARY(request(`${base}?scope=public&ids=${POST_ID},${DRAFT}&format=paragraphs`), { cms });
		expect(await res.json()).toMatchObject({ scope: "public", entries: 1, notPublished: 1, templates: 0, folders: 0 });

		const byPost = await SUMMARY_BY_POST(
			request(base, {
				method: "POST",
				headers: { origin: "http://localhost", "content-type": "application/json", host: "localhost" },
				body: JSON.stringify({ ids: [POST_ID] }),
			}),
			{ cms },
		);
		expect(await byPost.json()).toMatchObject({ entries: 1, templates: 0 });
	});

	it("DATA-B4 takes a collection as the selection of all its entries, and an empty one exports nothing instead of the whole site", async () => {
		const snapshot = makeExportFixtureSnapshot();
		const inCollection = snapshot.entries.filter((entry) => entry.collection === FIXTURE_CONTENT_COLLECTION).length;
		expect(inCollection).toBeGreaterThan(0);
		const whole = await (await SUMMARY(request(base), { cms })).json();
		const one = await (await SUMMARY(request(`${base}?collection=${FIXTURE_CONTENT_COLLECTION}`), { cms })).json();
		expect(one.entries).toBe(inCollection);
		expect(one.entries).toBeLessThanOrEqual(whole.entries);
		const none = await (await SUMMARY(request(`${base}?collection=nothing-here`), { cms })).json();
		expect(none).toMatchObject({ entries: 0 });
	});

	it("DATA-B4 rejects a format nobody provides and bad options", async () => {
		const unknown = await SUMMARY(request(`${base}?format=hugo`), { cms });
		expect(unknown.status).toBe(400);
		expect((await unknown.json()).error.code).toBe("unknown_format");
		expect((await SUMMARY(request(`${base}?scope=x`), { cms })).status).toBe(400);
	});
});
