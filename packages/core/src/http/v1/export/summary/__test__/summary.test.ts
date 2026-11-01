import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_CONTENT_COLLECTION, makeExportFixtureSnapshot } from "../../../../../../test/export-fixture";
import { paragraphsFormat } from "../../../../../../test/paragraphs-format";
import { testConfig } from "../../../../../../test/site";
import { AuthError } from "../../../../../adapters/auth";
import { fakeCms } from "../../../../../cms";
import { defineFormat } from "../../../../../format/types";
import { readZipArchive } from "../../../../../services/zip";
import { routeCaller } from "../../../../../testing";
import { GET as GETHandler } from "../../route";
import { GET as SUMMARY_GET, POST as SUMMARY_POST } from "../route";

const GET = routeCaller(GETHandler);
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

const request = (url: string, init?: RequestInit) => new Request(url, init);

const findFile = (zip: Uint8Array, path: string): string => {
	const entry = readZipArchive(zip).find((item) => item.path === path);
	if (!entry) throw new Error(`missing ${path}`);
	return decoder.decode(entry.data);
};

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
