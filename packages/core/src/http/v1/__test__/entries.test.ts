import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../../test/any-site";
import { testConfig } from "../../../../test/site";
import { AuthError } from "../../../adapters/auth";
import { fakeCms } from "../../../cms";
import { CmsError } from "../../../core/store";
import { routeCaller } from "../../../testing";
import { PATCH as patchEntryHandler } from "../entries/[id]/route";
import { GET as countEntriesHandler } from "../entries/counts/route";
import { GET as listEntriesHandler, POST as postEntriesHandler } from "../entries/route";
import { GET as searchEntriesHandler } from "../entries/search/route";
import { GET as getMetaHandler } from "../meta/route";

const patchEntry = routeCaller(patchEntryHandler);
const postEntries = routeCaller(postEntriesHandler);
const searchEntries = routeCaller(searchEntriesHandler);
const listEntries = routeCaller(listEntriesHandler);
const countEntries = routeCaller(countEntriesHandler);
const getMeta = routeCaller(getMetaHandler);

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
	countListValues: vi.fn().mockResolvedValue({ total: 3, empty: 1, values: { a: 2 } }),
	searchEntries: vi.fn().mockResolvedValue([{ id: "e1", title: "Hello", slug: "hello", status: "published" }]),
	getEntry: vi.fn().mockImplementation((id: string) => {
		if (id === "00000000-0000-4000-8000-000000000002") {
			throw new CmsError("Not found", "not_found");
		}
		return Promise.resolve({
			id,
			collection: contentCollection,
			version: 1,
			workingSlug: "my-post",
			working: { metadata: { title: "Title" }, mdx: "Hello" },
		});
	}),
	publishEntry: vi.fn().mockImplementation(({ id, expectedVersion }: { id: string; expectedVersion: number }) => {
		return Promise.resolve({
			id,
			version: expectedVersion + 1,
			status: "published",
		});
	}),
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
	saveDraft: vi.fn().mockImplementation((id, input) => {
		if (input.expectedVersion === 1) {
			throw new CmsError("Conflict", "conflict", { serverVersion: 2 });
		}
		if (input.slug === "existing-slug") {
			throw new CmsError("Slug conflict", "slug_conflict");
		}
		return Promise.resolve({
			warnings: [],
			entry: {
				id,
				collection: input.collection,
				version: input.expectedVersion + 1,
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

	it("returns 401 when user is unauthorized", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Not logged in"));
		const res = await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms });
		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.error.code).toBe("unauthorized");
	});

	it("returns 403 when user is forbidden", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("forbidden", "Wrong admin id"));
		const res = await getMeta(new Request("http://localhost/api/monti/v1/meta"), { cms });
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.error.code).toBe("forbidden");
	});

	it("rejects cross-origin mutations with 403", async () => {
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

	it("WRITE-S2 PATCH /entries/:id rejects without version with 428 version_required", async () => {
		const req = new Request("http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000008", {
			method: "PATCH",
			headers: {
				origin: "http://localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				metadata: { title: "Updated" },
			}),
		});

		const res = await patchEntry(req, { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000008" }), cms });
		expect(res.status).toBe(428);
		const data = await res.json();
		expect(data.error.code).toBe("version_required");
	});

	it("WRITE-S2 PATCH /entries/:id maps optimistic lock conflict to 409 and returns serverVersion", async () => {
		const req = new Request("http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000008", {
			method: "PATCH",
			headers: {
				origin: "http://localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				expectedVersion: 1, // trigger mock conflict
				metadata: { title: "Updated" },
			}),
		});

		const res = await patchEntry(req, { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000008" }), cms });
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.error.code).toBe("conflict");
		expect(data.error.details.serverVersion).toBe(2);
	});

	describe("GET /entries/search", () => {
		const search = (query: string) =>
			searchEntries(new Request(`http://localhost/api/monti/v1/entries/search?${query}`), { cms });

		it("passes the query, locale, publishedOnly and limit to the store and answers the hits", async () => {
			mockStore.searchEntries.mockClear();
			const res = await search(
				`collection=${contentCollection}&query=hel&locale=${cms.site.DEFAULT_LOCALE}&publishedOnly=true&limit=5`,
			);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ items: [{ id: "e1", title: "Hello", slug: "hello", status: "published" }] });
			expect(mockStore.searchEntries).toHaveBeenCalledWith({
				collection: contentCollection,
				query: "hel",
				locale: cms.site.DEFAULT_LOCALE,
				publishedOnly: true,
				limit: 5,
			});
		});

		it("looks entries up by repeated id", async () => {
			mockStore.searchEntries.mockClear();
			const ids = ["8a5fe1b2-6d7c-4a3b-9c1e-2f4d6b8a0c11", "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a8b"];
			await search(`collection=${contentCollection}&id=${ids[0]}&id=${ids[1]}`);
			expect(mockStore.searchEntries).toHaveBeenCalledWith({ collection: contentCollection, ids });
		});

		it("rejects an unknown collection, a limit that is too large and an id that is not an id", async () => {
			for (const query of [
				"collection=nope",
				`collection=${contentCollection}&limit=51`,
				`collection=${contentCollection}&limit=0`,
				`collection=${contentCollection}&id=abc`,
			]) {
				expect((await search(query)).status).toBe(400);
			}
		});
	});
	describe("GET /entries: field conditions and the translation filter", () => {
		const list = (query: string) => listEntries(new Request(`http://localhost/api/monti/v1/entries?${query}`), { cms });
		const TAG = "5c1e7a8e-2d0b-4f4b-9d57-3f6a1b9a0c11";

		it("passes repeated field conditions and translation states to the store", async () => {
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

		it("rejects a condition that is not one, and a translation state that is not one", async () => {
			for (const query of ["field=tags:maybe", "field=tags", "translation=stale"]) {
				expect((await list(`collection=${contentCollection}&${query}`)).status).toBe(400);
			}
		});
	});

	describe("GET /entries/counts", () => {
		const count = (query: string) =>
			countEntries(new Request(`http://localhost/api/monti/v1/entries/counts?${query}`), { cms });

		it("asks the store to count one field in the folder given, and answers the counts", async () => {
			mockStore.countListValues.mockClear();
			const res = await count(`collection=${contentCollection}&field=tags&group=translation&folderId=null`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ total: 3, empty: 1, values: { a: 2 } });
			expect(mockStore.countListValues).toHaveBeenCalledWith({
				collection: contentCollection,
				facet: { field: "tags" },
				groupTranslations: true,
				folderId: null,
			});
		});

		it("asks for the counts of the entry states with facet=status", async () => {
			mockStore.countListValues.mockClear();
			await count(`collection=${contentCollection}&facet=status`);
			expect(mockStore.countListValues).toHaveBeenCalledWith(
				expect.objectContaining({ collection: contentCollection, facet: "status" }),
			);
		});

		it("asks for the translation filter's counts with facet=translation", async () => {
			mockStore.countListValues.mockClear();
			await count(`collection=${contentCollection}&facet=translation`);
			expect(mockStore.countListValues).toHaveBeenCalledWith(
				expect.objectContaining({ collection: contentCollection, facet: "translation" }),
			);
		});

		it("rejects asking for nothing or for both", async () => {
			for (const query of ["", "&field=tags&facet=translation"]) {
				expect((await count(`collection=${contentCollection}${query}`)).status).toBe(400);
			}
		});
	});
});
