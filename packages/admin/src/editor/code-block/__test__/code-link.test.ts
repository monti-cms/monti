import { Editor } from "@tiptap/core";
import type { DecorationSet } from "@tiptap/pm/view";
import { afterEach, describe, expect, it } from "vitest";
import { mdxOfTiptap, tiptapOf } from "../../../test/mdx";
import { buildEditorExtensions } from "../../extensions";
import { codeEffectsKey, pickLines } from "../effects-plugin";
import { cancelLink, commitLink, findAnchor, startLinkFromLines, startLinkFromText, unlinkRef } from "../link-commands";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const SOURCE = ["이 함수가 값을 돌려준다.", "", "```ts", "function add(a, b) {", "  return a + b;", "}", "```"].join(
	"\n",
);

const mount = (source = SOURCE) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: tiptapOf(source) });
	return editor;
};

/** Document range of "함수가". */
const wordRange = (instance: Editor, word = "함수가") => {
	const from = 1 + instance.state.doc.child(0).textContent.indexOf(word);
	return { from, to: from + word.length };
};
const codePos = (instance: Editor) => instance.state.doc.child(0).nodeSize;
const save = (instance: Editor) => mdxOfTiptap(instance.getJSON()).trimEnd();

describe("linking body text to code (editor)", () => {
	it("pick body text first, then a line by its number, then link: the body link and line label are created together", () => {
		const instance = mount();
		const { from, to } = wordRange(instance);
		startLinkFromText(instance.view, from, to);
		expect(codeEffectsKey.getState(instance.state)?.linking).toEqual({ kind: "text", from, to });

		pickLines(instance.view, codePos(instance), 0, 2);
		expect(commitLink(instance.view)).toBe(true);

		expect(codeEffectsKey.getState(instance.state)?.linking).toBeNull();
		expect(save(instance)).toBe(
			[
				'이 <CodeRef to="c1">함수가</CodeRef> 값을 돌려준다.',
				"",
				"```ts",
				'// @line anchor {0-1} id="c1"',
				"function add(a, b) {",
				"  return a + b;",
				"}",
				"```",
			].join("\n"),
		);
	});

	it("pick a code line first, then body text, then link. For the same line, the label is reused", () => {
		const instance = mount();
		startLinkFromLines(instance.view, codePos(instance), 1, 2);
		const first = wordRange(instance, "함수가");
		instance.commands.setTextSelection(first);
		expect(commitLink(instance.view)).toBe(true);

		startLinkFromLines(instance.view, codePos(instance), 1, 2);
		instance.commands.setTextSelection(wordRange(instance, "값을"));
		commitLink(instance.view);

		const output = save(instance);
		expect(output).toContain('<CodeRef to="c1">함수가</CodeRef>');
		expect(output).toContain('<CodeRef to="c1">값을</CodeRef>');
		expect(output.match(/@line anchor/g)).toHaveLength(1);
	});

	it("does not link if there is no body text or no line is picked, and Esc or cancel backs out", () => {
		const instance = mount();
		startLinkFromText(instance.view, ...(Object.values(wordRange(instance)) as [number, number]));
		expect(commitLink(instance.view)).toBe(false);
		cancelLink(instance.view);
		expect(codeEffectsKey.getState(instance.state)?.linking).toBeNull();

		startLinkFromLines(instance.view, codePos(instance), 0, 1);
		instance.view.someProp("handleKeyDown", (handler) =>
			handler(instance.view, new KeyboardEvent("keydown", { key: "Escape" })),
		);
		expect(codeEffectsKey.getState(instance.state)?.linking).toBeNull();
	});

	it("unlinking also removes a line label that nothing points to anymore", () => {
		const instance = mount();
		const range = wordRange(instance);
		startLinkFromText(instance.view, range.from, range.to);
		pickLines(instance.view, codePos(instance), 0, 1);
		commitLink(instance.view);
		expect(findAnchor(instance.state.doc, "c1")).toMatchObject({ start: 0, end: 1 });

		unlinkRef(instance.view, range.from, range.to);
		expect(findAnchor(instance.state.doc, "c1")).toBeNull();
		expect(save(instance)).toBe(SOURCE);
	});

	it("a body link with no linked line is flagged with a red wavy underline", () => {
		const instance = mount('이 <CodeRef to="c9">함수가</CodeRef> 값을 돌려준다.');
		const plugin = codeEffectsKey.get(instance.state);
		const set = plugin?.props.decorations?.call(plugin, instance.state) as DecorationSet;
		const broken = set
			.find()
			.filter((decoration) =>
				(decoration as unknown as { type: { attrs?: { class?: string } } }).type.attrs?.class?.includes(
					"decoration-wavy",
				),
			);
		expect(broken.map((decoration) => [decoration.from, decoration.to])).toEqual([[3, 6]]);
	});
});
