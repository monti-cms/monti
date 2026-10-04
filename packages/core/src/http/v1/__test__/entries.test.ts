import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../test/any-site";
import { AuthError } from "../../../adapters/auth";
import { CmsError } from "../../../adapters/postgres/content-store";
import { PATCH as patchEntry } from "../entries/[id]/route";
import { POST as postEntries } from "../entries/route";
import { GET as getMeta } from "../meta/route";

const mockVerifyAdmin = vi.fn();

vi.mock("../../../adapters/auth", () => ({
	authGateway: {
		verifyAdmin: () => mockVerifyAdmin(),
	},
	AuthError: class AuthError extends Error {
		constructor(
			public code: string,
			message: string,
		) {
			super(message);
		}
	},
}));

vi.mock("../../../container", () => {
	const mockStore = {
		listEntries: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
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

	return {
		getCmsContentStore: () => mockStore,
		getCmsContentService: () => mockService,
	};
});

describe("M2-BE-3 HTTP API Contract (Updated with Security & Atomic Folders)", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockReset();
		mockVerifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
	});

	it("returns 401 when user is unauthorized", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Not logged in"));
		const res = await getMeta(new NextRequest("http://localhost/api/cms/v1/meta"));
		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.code).toBe("unauthorized");
	});

	it("returns 403 when user is forbidden", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("forbidden", "Wrong admin id"));
		const res = await getMeta(new NextRequest("http://localhost/api/cms/v1/meta"));
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.code).toBe("forbidden");
	});

	it("rejects cross-origin mutations with 403", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries", {
			method: "POST",
			headers: {
				origin: "http://attacker.com",
				"content-type": "application/json",
			},
			body: JSON.stringify({ collection: contentCollection }),
		});
		const res = await postEntries(req);
		expect(res.status).toBe(403);
		const data = await res.json();
		expect(data.code).toBe("forbidden");
	});

	it("POST /entries creates a new draft atomically with folderId", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries", {
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

		const res = await postEntries(req);
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.id).toBe("new-entry-id");
		expect(data.folderId).toBe("a0000000-0000-4000-8000-000000000001");
	});

	it("PATCH /entries/:id rejects without version with 428 version_required", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries/test-id", {
			method: "PATCH",
			headers: {
				origin: "http://localhost",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				metadata: { title: "Updated" },
			}),
		});

		const res = await patchEntry(req, { params: Promise.resolve({ id: "test-id" }) });
		expect(res.status).toBe(428);
		const data = await res.json();
		expect(data.code).toBe("version_required");
	});

	it("PATCH /entries/:id maps optimistic lock conflict to 409 and returns serverVersion", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries/test-id", {
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

		const res = await patchEntry(req, { params: Promise.resolve({ id: "test-id" }) });
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.code).toBe("conflict");
		expect(data.serverVersion).toBe(2);
	});
});
