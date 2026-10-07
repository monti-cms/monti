import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../test/any-site";
import { testConfig } from "../../../../test/site";
import { AuthError } from "../../../adapters/auth";
import { fakeCms } from "../../../cms";
import { CmsError } from "../../../core/store";
import { PATCH as patchEntry } from "../entries/[id]/route";
import { POST as postEntries } from "../entries/route";
import { GET as searchEntries } from "../entries/search/route";
import { GET as getMeta } from "../meta/route";

const mockVerifyAdmin = vi.fn();

const mockStore = {
	listEntries: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
	searchEntries: vi.fn().mockResolvedValue([{ id: "e1", title: "Hello", slug: "hello", status: "published" }]),
	getEntry: vi.fn().mockImplementation((id: string) => {
		if (id === "non-existent") {
			throw new CmsError("Not found", "not_found");
		}
		return Promise.resolve({
			id,
			collection: contentCollection,
			version: 1,
			workingSlug: "my-post",
			working: { metadata: { title: "Title" }, mdx: "Hello", schemaVersion: 1 },
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
			id: "new-entry-id",
			collection: input.collection,
			version: 1,
			workingSlug: input.slug,
			folderId: input.folderId,
		});
	}),
	saveDraft: vi.fn().mockImplementation((id, input) => {
		if (input.expectedVersion === 1) {
			throw new CmsError("Conflict", "conflict", 2);
		}
		if (input.slug === "existing-slug") {
			throw new CmsError("Slug conflict", "slug_conflict");
		}
		return Promise.resolve({
			id,
			collection: input.collection,
			version: input.expectedVersion + 1,
			workingSlug: input.slug,
			folderId: input.folderId,
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
		const res = await getMeta(new Request("http://localhost/api/cms/v1/meta"), { cms });
		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.code).toBe("unauthorized");
	});

	it("returns 403 when user is forbidden", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("forbidden", "Wrong admin id"));
		const res = await getMeta(new Request("http://localhost/api/cms/v1/meta"), { cms });
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.code).toBe("forbidden");
	});

	it("rejects cross-origin mutations with 403", async () => {
		const req = new Request("http://localhost/api/cms/v1/entries", {
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
		expect(data.code).toBe("forbidden");
	});

	it("POST /entries creates a new draft atomically with folderId", async () => {
		const req = new Request("http://localhost/api/cms/v1/entries", {
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
		expect(data.id).toBe("new-entry-id");
		expect(data.folderId).toBe("a0000000-0000-4000-8000-000000000001");
	});

	it("PATCH /entries/:id rejects without version with 428 version_required", async () => {
		const req = new Request("http://localhost/api/cms/v1/entries/test-id", {
			method: "PATCH",
			headers: {
				origin: "http://localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				metadata: { title: "Updated" },
			}),
		});

		const res = await patchEntry(req, { params: Promise.resolve({ id: "test-id" }), cms });
		expect(res.status).toBe(428);
		const data = await res.json();
		expect(data.code).toBe("version_required");
	});

	it("PATCH /entries/:id maps optimistic lock conflict to 409 and returns serverVersion", async () => {
		const req = new Request("http://localhost/api/cms/v1/entries/test-id", {
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

		const res = await patchEntry(req, { params: Promise.resolve({ id: "test-id" }), cms });
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.code).toBe("conflict");
		expect(data.serverVersion).toBe(2);
	});

	describe("GET /entries/search", () => {
		const search = (query: string) =>
			searchEntries(new Request(`http://localhost/api/cms/v1/entries/search?${query}`), { cms });

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
});
