import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { AuthError, authGateway } from "../../../../../../adapters/auth";
import { CmsError } from "../../../../../../adapters/postgres/content-store";
import { GET as getRelations } from "../route";

vi.mock("../../../../../../adapters/auth", () => ({
	authGateway: {
		verifyAdmin: vi.fn().mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true }),
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

vi.mock("../../../../../../container", () => {
	const mockStore = {
		getEntry: vi.fn().mockImplementation((id: string) => {
			if (id === "non-existent") {
				throw new CmsError("Not found", "not_found");
			}
			return Promise.resolve({ id, collection: "tag" });
		}),
		getIncomingReferences: vi.fn().mockResolvedValue([
			{
				state: "working",
				sourceId: "post-1",
				sourceCollection: "post",
				sourceTitle: "Post 1",
				sourceSlug: "post-1",
				kind: "entry",
				isStale: false,
				occurrences: [],
			},
		]),
	};

	return {
		getCmsContentStore: () => mockStore,
	};
});

describe("M2-BE-4 Relations API Contract", () => {
	it("GET /entries/:id/relations returns incoming references for existing entry", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries/tag-1/relations");
		const res = await getRelations(req, { params: Promise.resolve({ id: "tag-1" }) });

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.targetId).toBe("tag-1");
		expect(data.total).toBe(1);
		expect(data.incomingReferences[0].sourceId).toBe("post-1");
		expect(data.incomingReferences[0].state).toBe("working");
	});

	it("GET /entries/:id/relations requires admin access", async () => {
		vi.mocked(authGateway.verifyAdmin).mockRejectedValueOnce(new AuthError("unauthorized", "Not logged in"));
		const req = new NextRequest("http://localhost/api/cms/v1/entries/tag-1/relations");
		const res = await getRelations(req, { params: Promise.resolve({ id: "tag-1" }) });
		expect(res.status).toBe(401);
	});

	it("GET /entries/:id/relations returns 404 for nonexistent entry", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries/non-existent/relations");
		const res = await getRelations(req, { params: Promise.resolve({ id: "non-existent" }) });

		expect(res.status).toBe(404);
	});
});
