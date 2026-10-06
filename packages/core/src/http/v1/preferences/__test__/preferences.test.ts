import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, otherContentCollection, recordCollection } from "../../../../../test/any-site";
import { GET as getPreferences, PUT as putPreferences } from "../route";

/** Two collections used to tell the two settings apart (the reference blog setup uses posts and memos). Names are looked up from the config. */
const FIRST = contentCollection;
const SECOND = otherContentCollection ?? recordCollection;

vi.mock("../../../../adapters/auth", () => ({
	authGateway: {
		verifyAdmin: vi.fn().mockResolvedValue({ userId: "user-42", accountId: "user-42", isAdmin: true }),
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

const state = vi.hoisted(() => ({ stored: null as unknown }));

vi.mock("../../../../container", () => ({
	getCmsContentStore: () => ({
		getPreferences: vi.fn().mockImplementation(() => Promise.resolve(state.stored)),
		savePreferences: vi.fn().mockImplementation((params: { preferences: unknown }) => {
			state.stored = params.preferences;
			return Promise.resolve();
		}),
	}),
}));

const getReq = () => new NextRequest("http://localhost/api/cms/v1/preferences");
const putReq = (body: unknown) =>
	new NextRequest("http://localhost/api/cms/v1/preferences", {
		method: "PUT",
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("Preferences API — per-collection list preferences", () => {
	beforeEach(() => {
		state.stored = null;
	});

	it("stores page size, sort and columns per collection and merges partial updates", async () => {
		const initial = await (await getPreferences(getReq())).json();
		expect(initial.collections[FIRST]).toEqual({});

		const res = await putPreferences(
			putReq({ collections: { [FIRST]: { pageSize: 50, sort: { field: "publishedAt", direction: "asc" } } } }),
		);
		expect(res.status).toBe(200);
		await putPreferences(
			putReq({ collections: { [FIRST]: { columns: { order: ["title", "category"], visibility: { slug: true } } } } }),
		);
		await putPreferences(putReq({ collections: { [SECOND]: { pageSize: 100 } } }));

		const saved = await (await getPreferences(getReq())).json();
		expect(saved.collections[FIRST]).toEqual({
			pageSize: 50,
			sort: { field: "publishedAt", direction: "asc" },
			columns: { order: ["title", "category"], visibility: { slug: true } },
		});
		expect(saved.collections[SECOND]).toEqual({ pageSize: 100 });
	});

	it("drops the removed global shape instead of reading it as per-collection settings", async () => {
		state.stored = {
			defaultPageSize: 50,
			sort: { field: "title", direction: "asc" },
			columnSettings: { [SECOND]: { visibility: { tags: false } } },
			collections: { [FIRST]: { pageSize: 100 } },
		};
		const saved = await (await getPreferences(getReq())).json();
		expect(saved.collections[FIRST]).toEqual({ pageSize: 100 });
		expect(saved.collections[SECOND]).toEqual({});
		expect(JSON.stringify(saved)).not.toMatch(/defaultPageSize|columnSettings/);
	});

	it("rejects malformed column names, duplicate order entries and invalid page sizes with 400", async () => {
		for (const body of [
			{ collections: { [FIRST]: { columns: { order: ["title", "title"] } } } },
			{ collections: { [FIRST]: { columns: { visibility: { "not a column": true } } } } },
			{ collections: { [FIRST]: { columns: { order: ["title", "1st"] } } } },
			{ collections: { [FIRST]: { pageSize: 30 } } },
			{ collections: { unknown: { pageSize: 25 } } },
		]) {
			const res = await putPreferences(putReq(body));
			expect(res.status).toBe(400);
		}
	});
});
