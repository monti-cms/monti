import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { entriesKeys } from "../../api/entries";
import { jsonResponse as json } from "../../test/fetch";
import { renderHookWithSite } from "../../test/site";
import { parseListState } from "../list-state";
import { useEntryMutations } from "../use-entry-mutations";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@monti-cms/ui", async (importOriginal) => ({
	...(await importOriginal<typeof import("@monti-cms/ui")>()),
	toast,
}));

let fetchMock: ReturnType<typeof vi.fn>;
const bulkBodies = () =>
	fetchMock.mock.calls
		.filter(([url]) => url === "/api/monti/v1/bulk")
		.map(([, init]) => JSON.parse(String((init as RequestInit).body)));

beforeEach(() => {
	fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
		const { items } = JSON.parse(String(init?.body)) as { items: { id: string; expectedVersion: number }[] };
		return json({ results: items.map((item) => ({ id: item.id, ok: true, version: item.expectedVersion + 1 })) });
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const draft = { id: "draft-1", expectedVersion: 1, status: "draft" as const };
const archived = { id: "archived-1", expectedVersion: 2, status: "archived" as const };

const mount = () =>
	renderHookWithSite(() =>
		useEntryMutations({
			listKey: entriesKeys.list("collection=post"),
			state: parseListState(testSite, new URLSearchParams()),
			options: {},
			onResults: vi.fn(),
		}),
	).result;

describe("bulk lifecycle run", () => {
	it("sends only the rows that can take the transition", async () => {
		const mutations = mount();
		await act(() => mutations.current.run("archive", [draft, archived]));

		expect(bulkBodies()).toHaveLength(1);
		expect(bulkBodies()[0]).toMatchObject({ op: "archive", items: [{ id: "draft-1", expectedVersion: 1 }] });
	});

	it("sends every row for an action that is not a lifecycle change", async () => {
		const mutations = mount();
		await act(() => mutations.current.run("relation.add", [draft, archived], { field: "tags", ids: ["tag-1"] }));

		expect(bulkBodies()[0].items.map((item: { id: string }) => item.id)).toEqual(["draft-1", "archived-1"]);
	});
});
