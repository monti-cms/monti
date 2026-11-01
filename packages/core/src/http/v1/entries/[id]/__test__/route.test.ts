import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../../test/any-site";
import { testConfig } from "../../../../../../test/site";
import { fakeCms } from "../../../../../cms";
import { CmsError } from "../../../../../core/store";
import { routeCaller } from "../../../../../testing";
import { PATCH as patchEntryHandler } from "../route";

const patchEntry = routeCaller(patchEntryHandler);

const mockVerifyAdmin = vi.fn();

const mockStore = {
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
};

const mockService = {
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
});
