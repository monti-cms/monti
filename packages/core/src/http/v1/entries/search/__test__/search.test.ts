import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../../test/any-site";
import { testConfig } from "../../../../../../test/site";
import { fakeCms } from "../../../../../cms";
import { routeCaller } from "../../../../../testing";
import { GET as searchEntriesHandler } from "../route";

const searchEntries = routeCaller(searchEntriesHandler);

const mockVerifyAdmin = vi.fn();

const mockStore = {
	searchEntries: vi.fn().mockResolvedValue([{ id: "e1", title: "Hello", slug: "hello", status: "published" }]),
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

	describe("GET /entries/search", () => {
		const search = (query: string) =>
			searchEntries(new Request(`http://localhost/api/monti/v1/entries/search?${query}`), { cms });

		it("LIST-F7 passes the query, locale, publishedOnly and limit to the store and answers the hits", async () => {
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

		it("LIST-F7 looks entries up by repeated id", async () => {
			mockStore.searchEntries.mockClear();
			const ids = ["8a5fe1b2-6d7c-4a3b-9c1e-2f4d6b8a0c11", "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a8b"];
			await search(`collection=${contentCollection}&id=${ids[0]}&id=${ids[1]}`);
			expect(mockStore.searchEntries).toHaveBeenCalledWith({ collection: contentCollection, ids });
		});
	});
});
