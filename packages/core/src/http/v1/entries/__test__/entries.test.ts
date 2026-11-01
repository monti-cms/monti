import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../../../test/any-site";
import { testConfig } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import { routeCaller } from "../../../../testing";
import { GET as listEntriesHandler, POST as postEntriesHandler } from "../route";

const postEntries = routeCaller(postEntriesHandler);
const listEntries = routeCaller(listEntriesHandler);

const mockVerifyAdmin = vi.fn();

const mockStore = {
	getTranslationGroup: vi.fn().mockImplementation(({ entryId }: { entryId: string }) =>
		Promise.resolve({
			groupId: entryId,
			members: [
				{
					id: entryId,
					locale: defaultLocale,
					status: "draft",
					isSource: true,
					title: "Test Post",
					workingSlug: "test-slug",
				},
			],
		}),
	),
	listEntries: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
};

const mockService = {
	createDraft: vi.fn().mockImplementation((input) => {
		return Promise.resolve({
			warnings: [],
			entry: {
				id: "new-entry-id",
				collection: input.collection,
				version: 1,
				workingSlug: input.slug,
				folderId: input.folderId,
			},
		});
	}),
};

const cms = fakeCms({
	config: testConfig,
	store: mockStore,
	contentService: mockService,
	verifyAdmin: () => mockVerifyAdmin(),
});

describe("HTTP API Contract (Updated with Security & Atomic Folders)", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockReset();
		mockVerifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
	});

	it("API-G2 rejects cross-origin mutations with 403", async () => {
		const req = new Request("http://localhost/api/monti/v1/entries", {
			method: "POST",
			headers: {
				origin: "http://attacker.com",
				"content-type": "application/json",
			},
			body: JSON.stringify({ collection: contentCollection }),
		});
		const res = await postEntries(req, { cms });
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.error.code).toBe("forbidden");
	});

	it("WRITE-S1 POST /entries creates a new draft atomically with folderId", async () => {
		const req = new Request("http://localhost/api/monti/v1/entries", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				collection: contentCollection,
				slug: "test-slug",
				metadata: { title: "Test Post" },
				mdx: "# Test Content",
				folderId: "a0000000-0000-4000-8000-000000000001",
			}),
		});

		const res = await postEntries(req, { cms });
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.entry.id).toBe("new-entry-id");
		expect(data.entry.folderId).toBe("a0000000-0000-4000-8000-000000000001");
		// The answer carries the translation group, so the editor can show the saved language as existing without asking again.
		expect(data.entry.translations).toEqual([
			expect.objectContaining({ id: "new-entry-id", locale: defaultLocale, isSource: true }),
		]);
	});
	describe("GET /entries: field conditions and the translation filter", () => {
		const list = (query: string) => listEntries(new Request(`http://localhost/api/monti/v1/entries?${query}`), { cms });
		const TAG = "5c1e7a8e-2d0b-4f4b-9d57-3f6a1b9a0c11";

		it("LIST-F2 passes repeated field conditions and translation states to the store", async () => {
			mockStore.listEntries.mockClear();
			const res = await list(
				`collection=${contentCollection}&field=tags:empty&field=tags:is:${TAG}&field=summary:filled&translation=none&translation=changed`,
			);
			expect(res.status).toBe(200);
			expect(mockStore.listEntries).toHaveBeenCalledWith(
				expect.objectContaining({
					fields: { tags: [{ kind: "empty" }, { kind: "is", value: TAG }], summary: [{ kind: "filled" }] },
					translations: ["none", "changed"],
				}),
			);
		});
	});
});
