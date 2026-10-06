import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../../adapters/auth";
import { fakeCms } from "../../../cms";
import { STORED_DOCUMENT_VERSION } from "../../../doc/stored-document";
import { paragraphsFormat } from "../../../format/__test__/paragraphs-format";
import {
	FIXTURE_CONTENT_COLLECTION,
	FIXTURE_DRAFT_COLLECTION,
	fixtureEntryPath,
	makeExportFixtureSnapshot,
} from "../../../services/__test__/export-fixture";
import { readZipArchive } from "../../../services/zip";
import { GET, POST } from "../export/route";

const mockVerifyAdmin = vi.fn();
const mockReadExportSnapshot = vi.fn();

const cms = fakeCms({
	store: { readExportSnapshot: () => mockReadExportSnapshot() },
	verifyAdmin: () => mockVerifyAdmin(),
	formats: [paragraphsFormat],
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

describe("GET/POST /api/cms/v1/export", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
		mockReadExportSnapshot.mockResolvedValue(makeExportFixtureSnapshot());
	});

	it("returns 401 for an unauthenticated request", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Session required"));
		const res = await GET(request("http://localhost/api/cms/v1/export"), { cms });
		expect(res.status).toBe(401);
		expect((await res.json()).code).toBe("unauthorized");
	});

	it("returns 400 for an invalid scope", async () => {
		const res = await GET(request("http://localhost/api/cms/v1/export?scope=everything"), { cms });
		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("invalid_input");
	});

	it("default (admin) export returns a ZIP with a digest header and includes draft bodies", async () => {
		const res = await GET(request("http://localhost/api/cms/v1/export"), { cms });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/zip");
		expect(res.headers.get("content-disposition")).toContain("cms-export-admin-");
		expect(res.headers.get("x-cms-export-digest")).toMatch(/^[0-9a-f]{64}$/);

		const zip = new Uint8Array(await res.arrayBuffer());
		const manifest = JSON.parse(findFile(zip, "manifest.json"));
		expect(manifest.scope).toBe("admin");
		expect(manifest.formatVersion).toBe(4);
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

	it("an export with ?format= also writes every body as text in that format", async () => {
		const res = await GET(request("http://localhost/api/cms/v1/export?format=paragraphs"), { cms });
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

	it("a public export with a format holds the published text only, with no draft text in it", async () => {
		const res = await POST(
			request("http://localhost/api/cms/v1/export", {
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

	it("an export in a format nobody provides is a 400 unknown_format, and no archive", async () => {
		const res = await GET(request("http://localhost/api/cms/v1/export?format=hugo"), { cms });
		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("unknown_format");

		const bad = await GET(request("http://localhost/api/cms/v1/export?format=Not%20A%20Name"), { cms });
		expect(bad.status).toBe(400);
		expect((await bad.json()).code).toBe("invalid_input");
	});

	it("public export excludes drafts and does not include working values", async () => {
		const res = await GET(request("http://localhost/api/cms/v1/export?scope=public"), { cms });
		expect(res.status).toBe(200);
		expect(res.headers.get("x-cms-export-scope")).toBe("public");

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

	it("POST blocks cross-origin requests with 403", async () => {
		const res = await POST(
			request("http://localhost/api/cms/v1/export", {
				method: "POST",
				headers: { origin: "http://attacker.com", "content-type": "application/json", host: "localhost" },
				body: JSON.stringify({ scope: "public" }),
			}),
			{ cms },
		);
		expect(res.status).toBe(403);
	});

	it("POST accepts scope from the same origin and creates an archive", async () => {
		const res = await POST(
			request("http://localhost/api/cms/v1/export", {
				method: "POST",
				headers: { origin: "http://localhost", "content-type": "application/json", host: "localhost" },
				body: JSON.stringify({ scope: "public" }),
			}),
			{ cms },
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("x-cms-export-scope")).toBe("public");
	});

	it("maps a store error to 500 and does not expose the digest header", async () => {
		mockReadExportSnapshot.mockRejectedValue(new Error("db down"));
		const res = await GET(request("http://localhost/api/cms/v1/export"), { cms });
		expect(res.status).toBe(500);
		expect(res.headers.get("x-cms-export-digest")).toBeNull();
	});
});
