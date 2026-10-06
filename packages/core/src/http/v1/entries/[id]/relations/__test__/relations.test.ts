import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../../../../../adapters/auth";
import { fakeCms } from "../../../../../../cms";
import { CmsError } from "../../../../../../core/store";
import { GET as getRelations } from "../route";

const verifyAdmin = vi.fn();

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

const cms = fakeCms({ store: mockStore, verifyAdmin: () => verifyAdmin() });

describe("Relations API Contract", () => {
	beforeEach(() => {
		verifyAdmin.mockReset();
		verifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
	});

	it("GET /entries/:id/relations returns incoming references for existing entry", async () => {
		const req = new Request("http://localhost/api/cms/v1/entries/tag-1/relations");
		const res = await getRelations(req, { params: Promise.resolve({ id: "tag-1" }), cms });

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.targetId).toBe("tag-1");
		expect(data.total).toBe(1);
		expect(data.incomingReferences[0].sourceId).toBe("post-1");
		expect(data.incomingReferences[0].state).toBe("working");
	});

	it("GET /entries/:id/relations requires admin access", async () => {
		verifyAdmin.mockRejectedValueOnce(new AuthError("unauthorized", "Not logged in"));
		const req = new Request("http://localhost/api/cms/v1/entries/tag-1/relations");
		const res = await getRelations(req, { params: Promise.resolve({ id: "tag-1" }), cms });
		expect(res.status).toBe(401);
	});

	it("GET /entries/:id/relations returns 404 for nonexistent entry", async () => {
		const req = new Request("http://localhost/api/cms/v1/entries/non-existent/relations");
		const res = await getRelations(req, { params: Promise.resolve({ id: "non-existent" }), cms });

		expect(res.status).toBe(404);
	});
});
