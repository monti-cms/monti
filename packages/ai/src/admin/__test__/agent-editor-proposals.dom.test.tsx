import "@testing-library/jest-dom/vitest";
import { buildEditorExtensions } from "@monti-cms/admin/editor";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tiptapOf } from "../../../../admin/src/test/mdx";
import { SiteWrapper } from "../../../../admin/src/test/site";
import { testSite } from "../../../test/site";
import { useAgentProposalsExtension } from "../agent-editor-proposals";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

let editor: Editor;
let settled: { id: string; body: unknown }[];
beforeEach(() => {
	editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOf("One.\n\nTwo.") });
	const ids: string[] = [];
	editor.state.doc.forEach((node) => {
		ids.push(String(node.attrs.blockId));
	});
	settled = [];
	const view = (id: string, blockId: string) => ({
		id,
		proposalId: "p1",
		runId: "run-1",
		request: "tidy",
		blockId,
		block: { type: "paragraph", id: blockId, content: [{ type: "text", text: "x" }] },
		nodes: [],
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/v1/ai/proposals?entry="))
				return json({ items: [view("a", ids[0] ?? ""), view("b", ids[1] ?? "")] });
			const settle = url.match(/\/v1\/ai\/proposals\/([^/]+)\/settle$/);
			if (settle) {
				settled.push({ id: settle[1] ?? "", body: JSON.parse(String(init?.body)) });
				return json({ id: settle[1], items: [] });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
});
afterEach(() => {
	editor.destroy();
	vi.unstubAllGlobals();
});

const mount = () =>
	renderHook(
		() =>
			useAgentProposalsExtension({
				translateLocales: null,
				getEntry: () => ({ title: "", collection: "post", entryId: "e1" }),
			}),
		{
			wrapper: SiteWrapper,
		},
	);

describe("the agent's proposals in the editor", () => {
	it("ASSIST-E2 reports a discarded change at once and an accepted one only when the entry is saved", async () => {
		const { result } = mount();
		act(() => result.current.onEditor?.(editor));
		await waitFor(() => expect(result.current.proposals?.items).toHaveLength(2));
		const [first, second] = result.current.proposals?.items ?? [];
		act(() => result.current.proposals?.onDiscard([second as never]));
		await waitFor(() => expect(settled).toEqual([{ id: "p1", body: { discarded: ["b"] } }]));

		// Accepting removes the first block in the editor (its proposal removes it); nothing is reported until the save.
		act(() => {
			editor.commands.deleteRange({ from: 0, to: editor.state.doc.firstChild?.nodeSize ?? 0 });
			result.current.proposals?.onAccept(first as never, []);
		});
		expect(result.current.proposals?.items.map((item) => item.id)).toEqual([]);
		expect(settled).toHaveLength(1);
		act(() => result.current.onSaved?.());
		await waitFor(() => expect(settled.at(-1)).toEqual({ id: "p1", body: { accepted: [{ id: "a", placed: [] }] } }));
	});

	it("ASSIST-E2 does not report an accepted change that ⌘Z took back out before the save, and draws it again", async () => {
		const { result } = mount();
		act(() => result.current.onEditor?.(editor));
		await waitFor(() => expect(result.current.proposals?.items).toHaveLength(2));
		const [first] = result.current.proposals?.items ?? [];
		act(() => {
			editor.commands.deleteRange({ from: 0, to: editor.state.doc.firstChild?.nodeSize ?? 0 });
			result.current.proposals?.onAccept(first as never, []);
		});
		act(() => {
			editor.commands.undo();
		});
		await waitFor(() => expect(result.current.proposals?.items.map((item) => item.id)).toEqual(["a", "b"]));
		act(() => result.current.onSaved?.());
		expect(settled).toEqual([]);
	});
});
