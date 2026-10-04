import type { Editor, Range } from "@tiptap/core";
import { ADDED_BLOCK_INSERT_ACTIONS } from "./blocks/added";

export const OPEN_IMAGE_DIALOG_EVENT = "cms:open-image-dialog";
/** 첨부 파일 고르기 창을 연다(슬래시 메뉴 "파일"). */
export const OPEN_FILE_PICKER_EVENT = "cms:open-file-picker";

export type BlockInsertAction = (editor: Editor, range: Range) => void;

/**
 * 블록 정의(v2 B3)의 `editor.nodeView` 이름(본체 블록)이나 블록 이름(더한 블록) → 슬래시 메뉴 삽입 액션 등록부(v2 C3a).
 *
 * `editor.insertable === true`이고 `editor.view === 'node'`인 블록 중 여기에 액션이 등록된 것이
 * 슬래시 메뉴에 자동으로 나타난다. 더한 블록의 삽입은 정의의 `editor.insert`에서 만든다.
 */
export const BLOCK_INSERT_ACTIONS: Record<string, BlockInsertAction> = {
	image: (editor, range) => {
		editor.chain().focus().deleteRange(range).run();
		window.dispatchEvent(new CustomEvent(OPEN_IMAGE_DIALOG_EVENT));
	},
	math: (editor, range) => {
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsMath",
				attrs: {
					value: "E = mc^2",
				},
			})
			.run();
	},
	// 블록 확장·사이트 설정이 더한 블록(블록 이름).
	...ADDED_BLOCK_INSERT_ACTIONS,
};
