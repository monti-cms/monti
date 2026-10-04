import { Editor } from "@tiptap/core";
import type { DecorationSet } from "@tiptap/pm/view";
import { afterEach, describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../tiptap-content";
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
	editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(source) });
	return editor;
};

/** "함수가"의 문서 위치. */
const wordRange = (instance: Editor, word = "함수가") => {
	const from = 1 + instance.state.doc.child(0).textContent.indexOf(word);
	return { from, to: from + word.length };
};
const codePos = (instance: Editor) => instance.state.doc.child(0).nodeSize;
const save = (instance: Editor) => tiptapToMdx(instance.getJSON()).trimEnd();

describe("본문–코드 잇기(에디터)", () => {
	it("본문을 먼저 고르고 줄 번호로 줄을 고른 뒤 연결하면, 본문 연결과 줄 이름표가 함께 생긴다", () => {
		const instance = mount();
		const { from, to } = wordRange(instance);
		startLinkFromText(instance.view, from, to);
		expect(codeEffectsKey.getState(instance.state)?.linking).toEqual({ kind: "text", from, to });

		pickLines(instance.view, codePos(instance), 0, 2);
		expect(commitLink(instance.view)).toBe(true);

		expect(codeEffectsKey.getState(instance.state)?.linking).toBeNull();
		expect(save(instance)).toBe(
			[
				'이 :code-ref[함수가]{to="c1"} 값을 돌려준다.',
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

	it("코드 줄을 먼저 고르고 본문 글자를 고른 뒤 연결한다. 같은 줄이면 이름표를 다시 쓴다", () => {
		const instance = mount();
		startLinkFromLines(instance.view, codePos(instance), 1, 2);
		const first = wordRange(instance, "함수가");
		instance.commands.setTextSelection(first);
		expect(commitLink(instance.view)).toBe(true);

		startLinkFromLines(instance.view, codePos(instance), 1, 2);
		instance.commands.setTextSelection(wordRange(instance, "값을"));
		commitLink(instance.view);

		const output = save(instance);
		expect(output).toContain(':code-ref[함수가]{to="c1"}');
		expect(output).toContain(':code-ref[값을]{to="c1"}');
		expect(output.match(/@line anchor/g)).toHaveLength(1);
	});

	it("본문 글자가 없거나 줄을 고르지 않았으면 연결하지 않고, Esc·취소로 그만둔다", () => {
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

	it("연결을 끊으면 더는 가리키는 곳이 없는 줄 이름표도 지운다", () => {
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

	it("연결된 줄이 없는 본문 연결은 빨간 물결 밑줄로 알린다", () => {
		const instance = mount('이 :code-ref[함수가]{to="c9"} 값을 돌려준다.');
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
