import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, recordCollection } from "../../../../../../../test/any-site";
import { testConfig } from "../../../../../../../test/site";
import { fakeCms } from "../../../../../../cms";
import { CmsError } from "../../../../../../core/store";
import { routeCaller } from "../../../../../../testing";
import { GET as getRelationsHandler } from "../route";

const getRelations = routeCaller(getRelationsHandler);

const verifyAdmin = vi.fn();

const mockStore = {
	getEntry: vi.fn().mockImplementation((id: string) => {
		if (id === "00000000-0000-4000-8000-000000000002") {
			throw new CmsError("Not found", "not_found");
		}
		return Promise.resolve({ id, collection: recordCollection });
	}),
	getIncomingReferences: vi.fn().mockResolvedValue([
		{
			state: "working",
			sourceId: "post-1",
			sourceCollection: contentCollection,
			sourceTitle: "Post 1",
			sourceSlug: "post-1",
			kind: "entry",
			isStale: false,
			occurrences: [],
		},
	]),
};

const cms = fakeCms({ config: testConfig, store: mockStore, verifyAdmin: () => verifyAdmin() });

describe("Relations API Contract", () => {
	beforeEach(() => {
		verifyAdmin.mockReset();
		verifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
	});

	it("WRITE-W9 GET /entries/:id/relations returns incoming references for existing entry", async () => {
		const req = new Request("http://localhost/api/monti/v1/entries/00000000-0000-4000-8000-000000000004/relations");
		const res = await getRelations(req, {
			params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000004" }),
			cms,
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.targetId).toBe("00000000-0000-4000-8000-000000000004");
		expect(data.total).toBe(1);
		expect(data.incomingReferences[0].sourceId).toBe("post-1");
		expect(data.incomingReferences[0].state).toBe("working");
	});
});
