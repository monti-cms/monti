import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { entriesKeys } from "../../api/entries";
import { type FakeApi, fakeApi } from "../../test/fake-api";
import { renderHookWithSite } from "../../test/site";
import { parseListState } from "../list-state";
import { useEntryMutations } from "../use-entry-mutations";

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

let api: FakeApi;
const bulkBodies = () => api.sent("POST /v1/bulk").map((request) => request.body);

beforeEach(() => {
	api = fakeApi()
		.on("POST /v1/bulk", ({ body }) => ({
			results: (body.items as { id: string; expectedVersion: number }[]).map((item) => ({
				id: item.id,
				ok: true as const,
				version: item.expectedVersion + 1,
			})),
		}))
		.install();
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
	it("LIST-C5 sends only the rows that can take the transition", async () => {
		const mutations = mount();
		await act(() => mutations.current.run("archive", [draft, archived]));

		expect(bulkBodies()).toHaveLength(1);
		expect(bulkBodies()[0]).toMatchObject({ op: "archive", items: [{ id: "draft-1", expectedVersion: 1 }] });
	});
});
