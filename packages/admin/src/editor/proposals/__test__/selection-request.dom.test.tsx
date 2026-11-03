import "@testing-library/jest-dom/vitest";
import { buildEditorExtensions } from "@monti-cms/admin/editor";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { EditorProposals, EditorRequests } from "../../../admin-components";
import { tiptapOf } from "../../../test/mdx";
import { SiteWrapper } from "../../../test/site";
import { proposalMarksKey } from "../marks";
import { proposalMarksMessages } from "../messages";
import { useProposalMarks } from "../use-proposal-marks";

const t = testSite.createTranslator(proposalMarksMessages);
const box = () => screen.getByRole("textbox", { name: t("request") });

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

/** What the hook gives back, read by the test after each render. */
let latest: { requests: EditorRequests | null; run: ((editor: Editor) => void) | undefined } = {
	requests: null,
	run: undefined,
};

function Harness({ source, save, editor }: { source: EditorProposals; save: () => Promise<boolean>; editor: Editor }) {
	const marks = useProposalMarks([source], save);
	latest = { requests: marks.requests, run: marks.selectionActions[0]?.run };
	useEffect(() => marks.onEditor(editor), [marks.onEditor, editor]);
	return <>{marks.overlay}</>;
}

/** An editor on two paragraphs, with "kept the settings" selected in the second. */
const setUp = (onAskAt: EditorProposals["onAskAt"], save = vi.fn(async () => true)) => {
	editor = new Editor({
		extensions: buildEditorExtensions(testSite),
		content: tiptapOf("The list keeps the title.\n\nI kept the settings as they were."),
	});
	const second = editor.state.doc.child(0).nodeSize;
	const start = second + 1 + "I ".length;
	editor.commands.setTextSelection({ from: start, to: start + "kept the settings".length });
	const source: EditorProposals = { items: [], onAccept: vi.fn(), onDiscard: vi.fn(), onAskAt };
	render(<Harness source={source} save={save} editor={editor} />, { wrapper: SiteWrapper });
	return { editor, save };
};

/** Writes in the card's box and presses Enter. */
const write = (box: HTMLElement, text: string) => {
	fireEvent.change(box, { target: { value: text } });
	fireEvent.keyDown(box, { key: "Enter" });
};

const spots = (current: Editor) => proposalMarksKey.getState(current.state)?.spots ?? [];

describe("a request on selected words", () => {
	it("ASSIST-E4 marks the selected words and opens an empty card with only the box, and drops them when the card closes unsent", async () => {
		const { editor } = setUp(vi.fn(async () => null));
		await waitFor(() => expect(latest.run).toBeTypeOf("function"));
		act(() => latest.run?.(editor));

		const card = await screen.findByRole("dialog");
		// Nothing to discard or accept yet: no head, only the box.
		expect(
			within(card)
				.queryAllByRole("button")
				.map((button) => button.getAttribute("aria-label")),
		).toEqual([t("send")]);
		expect(box()).toHaveFocus();
		const [spot] = spots(editor);
		expect(spot && editor.state.doc.textBetween(spot.from, spot.to)).toBe("kept the settings");

		fireEvent.keyDown(box(), { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(spots(editor)).toEqual([]);
	});

	it("ASSIST-E4 saves the entry before sending, shows the request as being worked on, and counts it in the status bar", async () => {
		const order: string[] = [];
		let answer: (id: string | null) => void = () => undefined;
		const onAskAt = vi.fn(
			(spot: { words: string; blockId: string }, text: string) =>
				new Promise<string | null>((resolve) => {
					order.push(`ask:${spot.words}:${text}`);
					answer = resolve;
				}),
		);
		const save = vi.fn(async () => {
			order.push("save");
			return true;
		});
		const { editor } = setUp(onAskAt, save);
		await waitFor(() => expect(latest.run).toBeTypeOf("function"));
		act(() => latest.run?.(editor));

		write(await waitFor(box), "one sentence");
		await waitFor(() => expect(order).toEqual(["save", "ask:kept the settings:one sentence"]));
		expect(screen.getByRole("dialog")).toHaveTextContent(t("working"));
		expect(spots(editor)[0]?.working).toBe(true);
		expect(latest.requests).toMatchObject({ answered: 0, working: 1 });

		await act(async () => answer(null));
		expect(spots(editor)).toEqual([]);
		expect(latest.requests).toBeNull();
	});

	it("ASSIST-E4 does not send when the save fails, and keeps what was written", async () => {
		const onAskAt = vi.fn(async () => null);
		const { editor } = setUp(
			onAskAt,
			vi.fn(async () => false),
		);
		await waitFor(() => expect(latest.run).toBeTypeOf("function"));
		act(() => latest.run?.(editor));
		const input = await waitFor(box);
		write(input, "one sentence");
		await waitFor(() => expect(input).toHaveValue("one sentence"));
		expect(onAskAt).not.toHaveBeenCalled();
		expect(spots(editor)[0]?.working).toBe(false);
	});

	it("ASSIST-E4 stops a request being worked on: the request is cut off, the words stay marked and what was written comes back", async () => {
		let stopped: AbortSignal | null = null;
		const onAskAt = vi.fn(
			(_spot: { words: string; blockId: string }, _text: string, signal: AbortSignal) =>
				new Promise<string | null>((_resolve, reject) => {
					stopped = signal;
					signal.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")));
				}),
		);
		const { editor } = setUp(onAskAt);
		await waitFor(() => expect(latest.run).toBeTypeOf("function"));
		act(() => latest.run?.(editor));
		write(await waitFor(box), "one sentence");
		await waitFor(() => expect(onAskAt).toHaveBeenCalled());

		fireEvent.click(screen.getByRole("button", { name: t("stop") }));
		await waitFor(() => expect(box()).toHaveValue("one sentence"));
		expect((stopped as AbortSignal | null)?.aborted).toBe(true);
		expect(spots(editor)).toMatchObject([{ working: false }]);
		expect(screen.queryByRole("button", { name: t("stop") })).toBeNull();
	});
});
