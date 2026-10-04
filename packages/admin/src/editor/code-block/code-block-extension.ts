import { CODE_BLOCK_MARKS } from "@monti-cms/core/code-block";
import { CodeBlock } from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockView } from "./code-block-view";
import { createCodeEffectsPlugin } from "./effects-plugin";
import { createCodeBlockHighlightPlugin } from "./highlight-plugin";
import { createCodeBlockKeysPlugin } from "./keys";

const hidden = (value: unknown) => ({ default: value, rendered: false });

/**
 * CMS 코드 블록. 코드 텍스트에 글자 효과 마크를 허용하고(`CODE_BLOCK_MARKS`), 줄 효과·정규식 규칙은 속성에 둔다(model.ts).
 * `source`/`sourceKey`는 불러온 원문과 그때의 모델 지문이다. 바뀌지 않았으면 원문을 그대로 저장한다.
 * `rawMode`면 에디터가 나타낼 수 없는 주석이 있어 주석 줄까지 원문으로 편집한다.
 */
export const CmsCodeBlock = CodeBlock.extend({
	name: "codeBlock",
	marks: CODE_BLOCK_MARKS,

	addAttributes() {
		return {
			...this.parent?.(),
			meta: hidden(null),
			lineEffects: hidden([]),
			rules: hidden([]),
			source: hidden(null),
			sourceKey: hidden(null),
			rawMode: hidden(false),
		};
	},

	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockView, {
			// 머리 도구·줄 번호 칸·줄 메뉴의 누름·끌기는 편집기(선택·블록 선택)가 처리하지 않는다.
			stopEvent: ({ event }) => event.target instanceof Element && event.target.closest("[data-code-ui]") !== null,
		});
	},

	addProseMirrorPlugins() {
		return [
			...(this.parent?.() ?? []),
			createCodeBlockKeysPlugin(),
			createCodeBlockHighlightPlugin(),
			createCodeEffectsPlugin(),
		];
	},
});
