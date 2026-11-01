import { describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../../../test/any-site";
import { testConfig } from "../../../../../../../test/site";
import { fakeCms } from "../../../../../../cms";
import { CmsError } from "../../../../../../core/store";
import { routeCaller } from "../../../../../../testing";
import { POST as postDuplicateHandler } from "../route";

const postDuplicate = routeCaller(postDuplicateHandler);

const duplicateEntry = vi.fn(({ id, title }: { id: string; title?: string }) => {
	if (id === "00000000-0000-4000-8000-000000000003")
		return Promise.reject(new CmsError("Entry not found", "not_found"));
	return Promise.resolve({
		warnings: [],
		entry: {
			id: "new-duplicated-id",
			collection: contentCollection,
			version: 1,
			status: "draft",
			workingSlug: null,
			folderId: "folder-1",
			working: {
				metadata: { title: title ?? "Original" },
				mdx: "body",
			},
		},
	});
});

const cms = fakeCms({
	config: testConfig,
	store: {
		getTranslationGroup: async ({ entryId }: { entryId: string }) => ({ groupId: entryId, members: [] }),
	} as never,
	contentService: { duplicate: duplicateEntry as never },
});

const postReq = (url: string, origin = "http://localhost", body?: unknown) =>
	new Request(url, {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

describe("Duplicate API Route", () => {
	it("WRITE-W10 passes the caller's copy title to the service", async () => {
		const res = await postDuplicate(
			postReq(
				"http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000001/duplicate",
				"http://localhost",
				{
					title: "Original (copy)",
				},
			),
			{ params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }), cms },
		);
		expect(res.status).toBe(201);
		expect((await res.json()).entry.working.metadata.title).toBe("Original (copy)");
		expect(duplicateEntry).toHaveBeenLastCalledWith({
			id: "00000000-0000-4000-8000-000000000001",
			title: "Original (copy)",
		});
	});
});
