import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteWrapper } from "../../../../admin/src/test/site";
import { useAgentMediaProposals } from "../agent-media-proposals";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

let settled: { id: string; body: unknown }[];
beforeEach(() => {
	settled = [];
	const view = (id: string, mediaId: string) => ({
		id,
		proposalId: "p1",
		runId: "run-1",
		request: "alt texts",
		mediaId,
		before: null,
		value: `alt of ${mediaId}`,
		thread: [],
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/v1/ai/proposals?media"))
				return json({ items: settled.length > 0 ? [] : [view("a", "m1"), view("b", "m2")] });
			const settle = url.match(/\/v1\/ai\/proposals\/([^/]+)\/settle$/);
			if (settle) {
				settled.push({ id: settle[1] ?? "", body: JSON.parse(String(init?.body)) });
				return json({ id: settle[1], items: [] });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
});
afterEach(() => vi.unstubAllGlobals());

describe("the agent's proposals on the media tiles", () => {
	it("ASSIST-E6 hands the waiting alt texts to the library, and applies the accepted ones at once", async () => {
		const { result } = renderHook(() => useAgentMediaProposals(), { wrapper: SiteWrapper });
		await waitFor(() => expect(result.current?.items.map((item) => item.mediaId)).toEqual(["m1", "m2"]));
		const [first] = result.current?.items ?? [];
		act(() => result.current?.onAccept([first as never]));
		// Off the tile at once, and applied on the server.
		expect(result.current?.items.map((item) => item.id)).toEqual(["b"]);
		await waitFor(() => expect(settled).toEqual([{ id: "p1", body: { applied: ["a"] } }]));
	});
});
