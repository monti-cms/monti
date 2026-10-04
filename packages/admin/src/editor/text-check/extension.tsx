"use client";

import { DEFAULT_LOCALE, type TextChecker } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { useState } from "react";
import type { EditorExtensionContext, EditorExtensionResult } from "../../admin-components";
import { TextCheckToolbar, TextIssuePopover } from "./text-check-controls";
import { useTextCheck } from "./use-text-check";

/**
 * 글 검사(맞춤법 등) 화면. 확장이 관리자 확장점 `textCheckers`에 검사기를 넣으면 검사기마다 도구 모음 버튼이 생기고,
 * 결과는 물결 밑줄·결과 창·목록으로 보인다. 본체는 검사기를 하나도 갖지 않고, 그 글의 언어를 검사하는 검사기가 없으면
 * 아무것도 그리지 않는다.
 */
export function useTextCheckEditor(
	checkers: readonly TextChecker[],
	context: EditorExtensionContext,
): EditorExtensionResult {
	const [editor, setEditor] = useState<Editor | null>(null);
	const locale = context.getEntry?.().locale ?? DEFAULT_LOCALE;
	const controller = useTextCheck(editor, { checkers, locale });
	return {
		onEditor: setEditor,
		toolbar: controller ? <TextCheckToolbar controller={controller} /> : null,
		overlay: controller ? <TextIssuePopover controller={controller} /> : null,
	};
}
