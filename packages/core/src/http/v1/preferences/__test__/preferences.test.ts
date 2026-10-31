import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, otherContentCollection, recordCollection } from "../../../../../test/any-site";
import { testConfig, testSite } from "../../../../../test/site";
import { fakeCms } from "../../../../cms";
import { routeCaller } from "../../../../testing";
import { GET as getPreferencesHandler, PUT as putPreferencesHandler } from "../route";

const getPreferences = routeCaller(getPreferencesHandler);
const putPreferences = routeCaller(putPreferencesHandler);

/** Two collections used to tell the two settings apart (the reference blog setup uses posts and memos). Names are looked up from the config. */
const FIRST = contentCollection;
const SECOND = otherContentCollection ?? recordCollection;
/** A field of the first collection other than the title, to save as a column. */
const COLUMN = testSite.storedFields(FIRST).find(({ name }) => name !== "title")?.name;
if (!COLUMN) throw new Error("preferences test: the content collection has no field besides the title");

const state = { stored: null as unknown };

const cms = fakeCms({
	config: testConfig,
	store: {
		getPreferences: vi.fn().mockImplementation(() => Promise.resolve(state.stored)),
		savePreferences: vi.fn().mockImplementation((params: { preferences: unknown }) => {
			state.stored = params.preferences;
			return Promise.resolve();
		}),
	},
	verifyAdmin: async () => ({ userId: "user-42", accountId: "user-42", isAdmin: true }),
});

const getReq = () => new Request("http://localhost/api/monti/v1/preferences");
const putReq = (body: unknown) =>
	new Request("http://localhost/api/monti/v1/preferences", {
		method: "PUT",
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("Preferences API — per-collection list preferences", () => {
	beforeEach(() => {
		state.stored = null;
	});

	it("LIST-S1 stores page size, sort and columns per collection and merges partial updates", async () => {
		const initial = await (await getPreferences(getReq(), { cms })).json();
		expect(initial.collections[FIRST]).toEqual({});

		const res = await putPreferences(
			putReq({ collections: { [FIRST]: { pageSize: 50, sort: { field: "publishedAt", direction: "asc" } } } }),
			{ cms },
		);
		expect(res.status).toBe(200);
		await putPreferences(
			putReq({ collections: { [FIRST]: { columns: { order: ["title", COLUMN], visibility: { slug: true } } } } }),
			{ cms },
		);
		await putPreferences(putReq({ collections: { [SECOND]: { pageSize: 100 } } }), { cms });

		const saved = await (await getPreferences(getReq(), { cms })).json();
		expect(saved.collections[FIRST]).toEqual({
			pageSize: 50,
			sort: { field: "publishedAt", direction: "asc" },
			columns: { order: ["title", COLUMN], visibility: { slug: true } },
		});
		expect(saved.collections[SECOND]).toEqual({ pageSize: 100 });
	});

});
