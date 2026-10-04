import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CmsError } from "../../../adapters/postgres/content-store";
import { POST as postDuplicate } from "../entries/[id]/duplicate/route";

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

const duplicateEntry = vi.fn(({ id, title }: { id: string; title?: string }) => {
	if (id === "ghost") return Promise.reject(new CmsError("Entry not found", "not_found"));
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

vi.mock("../../../container", () => ({
	getCmsContentStore: () => ({ duplicateEntry }),
}));

const postReq = (url: string, origin = "http://localhost", body?: unknown) =>
	new NextRequest(url, {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

describe("M5-BE-1 Duplicate API Route", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
	});

	it("duplicates entry with 201 Created", async () => {
		const res = await postDuplicate(postReq("http://localhost/api/cms/v1/entries/orig-1/duplicate"), {
			params: Promise.resolve({ id: "orig-1" }),
		});
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.id).toBe("new-duplicated-id");
		expect(data.status).toBe("draft");
		expect(data.working.metadata.title).toBe("Original");
		expect(duplicateEntry).toHaveBeenLastCalledWith({ id: "orig-1", title: undefined });
	});

	it("passes the caller's copy title to the store", async () => {
		const res = await postDuplicate(
			postReq("http://localhost/api/cms/v1/entries/orig-1/duplicate", "http://localhost", { title: "Original (copy)" }),
			{ params: Promise.resolve({ id: "orig-1" }) },
		);
		expect(res.status).toBe(201);
		expect((await res.json()).working.metadata.title).toBe("Original (copy)");
		expect(duplicateEntry).toHaveBeenLastCalledWith({ id: "orig-1", title: "Original (copy)" });
	});

	it("rejects a non-string title with 400", async () => {
		const res = await postDuplicate(
			postReq("http://localhost/api/cms/v1/entries/orig-1/duplicate", "http://localhost", { title: 1 }),
			{ params: Promise.resolve({ id: "orig-1" }) },
		);
		expect(res.status).toBe(400);
	});

	it("returns 404 when entry does not exist", async () => {
		const res = await postDuplicate(postReq("http://localhost/api/cms/v1/entries/ghost/duplicate"), {
			params: Promise.resolve({ id: "ghost" }),
		});
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.code).toBe("not_found");
	});

	it("rejects cross-origin requests with 403", async () => {
		const res = await postDuplicate(
			postReq("http://localhost/api/cms/v1/entries/orig-1/duplicate", "http://evil.com"),
			{
				params: Promise.resolve({ id: "orig-1" }),
			},
		);
		expect(res.status).toBe(403);
	});
});
