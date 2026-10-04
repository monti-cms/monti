import StarterKit from "@tiptap/starter-kit";
import { ADDED_MARKS, createAddedMark, type EditorMarkSpec } from "./added-marks";
import { CmsBlockKeymap } from "./block-commands";
import { BLOCK_NODE_VIEWS } from "./block-views";
import { ADDED_BLOCK_NODES } from "./blocks/added";
import { CmsBlockDrag } from "./drag";
import { CMS_SCHEMA_EXTENSIONS } from "./tiptap-schema";

/**
 * 편집기 확장 조립(v2 C0). 기능 확장(키 처리·드래그·플러그인)은 이 목록에 더한다.
 * 스키마 노드는 `tiptap-schema.ts`, 전용 편집 UI가 있는 블록 노드는 `block-views.ts`,
 * CmsNode ↔ Tiptap 변환은 `converters/`에 둔다. 더한 글자 꾸밈의 모양(`marks`)은 관리자 확장(`CmsAdminComponents.marks`)이 준다.
 */
export function buildEditorExtensions(marks: Readonly<Record<string, EditorMarkSpec>> = {}) {
	return [
		StarterKit.configure({
			// 본문 삽입은 H2부터지만(§4.1) 이전 글의 H1·H5·H6도 원래 수준으로 보여 준다.
			heading: { levels: [1, 2, 3, 4, 5, 6] },
			// `meta`를 보존하는 CmsCodeBlock을 쓴다(CMS_SCHEMA_EXTENSIONS).
			codeBlock: false,
			link: { openOnClick: false },
		}),
		...CMS_SCHEMA_EXTENSIONS,
		...Object.values(BLOCK_NODE_VIEWS),
		// 블록 확장·사이트 설정이 더한 블록(`editor.view: "node"`).
		...ADDED_BLOCK_NODES,
		// 블록 확장·사이트 설정이 더한 글자 꾸밈. 모양은 확장이 준다(`marks`, 블록 이름 → 모양).
		...[...ADDED_MARKS.values()].map((block) => createAddedMark(block, marks[block.name])),
		CmsBlockKeymap,
		CmsBlockDrag,
	];
}
