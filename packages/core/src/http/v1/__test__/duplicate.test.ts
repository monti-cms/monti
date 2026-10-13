import { describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../test/site";
import { fakeCms } from "../../../cms";
import { CmsError } from "../../../core/store";
import { routeCaller } from "../../../testing";
import { POST as postDuplicateHandler } from "../entries/[id]/duplicate/route";

const postDuplicate = routeCaller(postDuplicateHandler);

const duplicateEntry = vi.fn(({ id, title }: { id: string; title?: string }) => {
	if (id === "00000000-0000-4000-8000-000000000003")
		return Promise.reject(new CmsError("Entry not found", "not_found"));
	return Promise.resolve({
		id: "new-duplicated-id",
		collection: "post",
		version: 1,
		status: "draft",
		workingSlug: null,
		folderId: "folder-1",
		working: {
			metadata: { title: title ?? "Original" },
			mdx: "body",
			schemaVersion: 1,
		},
	});
});

const cms = fakeCms({ config: testConfig, contentService: { duplicate: duplicateEntry as never } });

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
	it("duplicates entry with 201 Created", async () => {
		const res = await postDuplicate(
			postReq("http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000001/duplicate"),
			{
				params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
				cms,
			},
		);
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.id).toBe("new-duplicated-id");
		expect(data.status).toBe("draft");
		expect(data.working.metadata.title).toBe("Original");
		expect(duplicateEntry).toHaveBeenLastCalledWith({ id: "00000000-0000-4000-8000-000000000001", title: undefined });
	});

	it("passes the caller's copy title to the service", async () => {
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
		expect((await res.json()).working.metadata.title).toBe("Original (copy)");
		expect(duplicateEntry).toHaveBeenLastCalledWith({
			id: "00000000-0000-4000-8000-000000000001",
			title: "Original (copy)",
		});
	});

	it("rejects a non-string title with 400", async () => {
		const res = await postDuplicate(
			postReq(
				"http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000001/duplicate",
				"http://localhost",
				{ title: 1 },
			),
			{ params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }), cms },
		);
		expect(res.status).toBe(400);
	});

	it("returns 404 when entry does not exist", async () => {
		const res = await postDuplicate(
			postReq("http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000003/duplicate"),
			{
				params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000003" }),
				cms,
			},
		);
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.error.code).toBe("not_found");
	});

	it("rejects cross-origin requests with 403", async () => {
		const res = await postDuplicate(
			postReq(
				"http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000001/duplicate",
				"http://evil.com",
			),
			{
				params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
				cms,
			},
		);
		expect(res.status).toBe(403);
	});
});
