import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../../test/any-site";
import { testConfig } from "../../../../../../test/site";
import { fakeCms } from "../../../../../cms";
import { routeCaller } from "../../../../../testing";
import { GET as countEntriesHandler } from "../route";

const countEntries = routeCaller(countEntriesHandler);

const mockVerifyAdmin = vi.fn();

const mockStore = {
	countListValues: vi.fn().mockResolvedValue({ total: 3, empty: 1, values: { a: 2 } }),
};

const cms = fakeCms({
	config: testConfig,
	store: mockStore,
	verifyAdmin: () => mockVerifyAdmin(),
});

describe("HTTP API Contract (Updated with Security & Atomic Folders)", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockReset();
		mockVerifyAdmin.mockResolvedValue({ userId: "123", accountId: "123", isAdmin: true });
	});

	describe("GET /entries/counts", () => {
		const count = (query: string) =>
			countEntries(new Request(`http://localhost/api/monti/v1/entries/counts?${query}`), { cms });

		it("LIST-F3 asks the store to count one field in the folder given, and answers the counts", async () => {
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

		it("LIST-F3 asks for the counts of the entry states with facet=status", async () => {
			mockStore.countListValues.mockClear();
			await count(`collection=${contentCollection}&facet=status`);
			expect(mockStore.countListValues).toHaveBeenCalledWith(
				expect.objectContaining({ collection: contentCollection, facet: "status" }),
			);
		});
	});
});
