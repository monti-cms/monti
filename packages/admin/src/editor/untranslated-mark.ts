import { Mark, mergeAttributes } from "@tiptap/core";
import type { MarkType } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";

export const UNTRANSLATED_MARK_NAME = "untranslated";

/** 커서가 있는 글 블록(문단·제목·목록 항목 글 등)에서 번역 안내 글의 자리들. */
const hintRangesAt = (state: EditorState, pos: number, type: MarkType): { from: number; to: number }[] => {
	const $pos = state.doc.resolve(pos);
	const block = $pos.parent;
	if (!block.isTextblock) return [];
	const start = $pos.start();
	const ranges: { from: number; to: number }[] = [];
	block.forEach((child, offset) => {
		if (child.isText && type.isInSet(child.marks)) {
			ranges.push({ from: start + offset, to: start + offset + child.nodeSize });
		}
	});
	return ranges;
};

/** 안내 글을 모두 지우는 트랜잭션. 지울 것이 없으면 `null`. */
const clearHints = (state: EditorState, pos: number, type: MarkType): Transaction | null => {
	const ranges = hintRangesAt(state, pos, type);
	if (ranges.length === 0) return null;
	const tr = state.tr;
	for (const range of [...ranges].reverse()) tr.delete(range.from, range.to);
	return tr.removeStoredMark(type);
};

/**
 * 번역 안내 글(v3). 새 번역본은 원문 글을 이 표시로 감싸 둔다. 흐리게 보이고, 그 글 블록에 입력을 시작하면
 * (글자·붙여넣기·한글 조합·지우기) 안내 글을 한 번에 지운 뒤 입력한다. 안내 글 뒤에 이어 친 글자가 안내 글이
 * 되지 않게 `inclusive`를 끈다.
 */
export const CmsUntranslatedMark = Mark.create({
	name: UNTRANSLATED_MARK_NAME,
	inclusive: false,
	excludes: "",
	parseHTML() {
		return [{ tag: "span[data-untranslated]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				"data-untranslated": "",
				// 원문 글이라 번역 언어 맞춤법 검사 밑줄을 띄우지 않는다.
				spellcheck: "false",
				class: "text-cms-muted-foreground/70",
			}),
			0,
		];
	},
	addProseMirrorPlugins() {
		const type = this.type;
		return [
			new Plugin({
				key: new PluginKey("cmsUntranslated"),
				props: {
					handleTextInput(view, from, to, text) {
						const tr = clearHints(view.state, from, type);
						if (!tr) return false;
						tr.insertText(text, tr.mapping.map(from, -1), tr.mapping.map(to, 1));
						view.dispatch(tr.scrollIntoView());
						return true;
					},
					handleKeyDown(view, event) {
						if (event.key !== "Backspace" && event.key !== "Delete") return false;
						const tr = clearHints(view.state, view.state.selection.from, type);
						if (!tr) return false;
						view.dispatch(tr);
						return true;
					},
					handlePaste(view) {
						// 안내 글을 먼저 지우고, 붙여넣기는 에디터 기본 처리에 맡긴다.
						const tr = clearHints(view.state, view.state.selection.from, type);
						if (tr) view.dispatch(tr);
						return false;
					},
					handleDOMEvents: {
						// 한글 등 조합 입력은 조합이 시작되기 전에 지워야 조합이 깨지지 않는다.
						compositionstart(view) {
							const tr = clearHints(view.state, view.state.selection.from, type);
							if (tr) view.dispatch(tr);
							return false;
						},
					},
				},
			}),
		];
	},
});
