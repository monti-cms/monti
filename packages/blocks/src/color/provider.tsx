"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import {
	allowsMark,
	BubbleButton,
	type EditorBubbleProps,
	type EditorMarkExtension,
	type MarkAttrs,
} from "@monti-cms/admin/editor";
import { DropdownMenuSeparator } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { cleanTextColor, textColorProps } from "./colors";
import { colorBlock } from "./definition";
import { COLOR_MARK_NAME, TextColorIcon, TextColorMenu, TextColorMenuItems, TextColorPanel } from "./menu";
import { colorMessages } from "./messages";

const t = createTranslator(colorMessages);

/** 편집기의 글자색 표시. 공개 화면과 같은 `.cms-color` 규칙(`styles.css`)이 테마에 맞는 색을 고른다. */
export function colorMarkAttributes(attrs: MarkAttrs): Record<string, string> {
	const { className, style, ...data } = textColorProps(cleanTextColor(attrs));
	return {
		...data,
		class: className,
		style: Object.entries(style)
			.map(([key, value]) => `${key}: ${value}`)
			.join("; "),
	};
}

function ColorBubbleButton({ editor, inCode, openPanel, closePanel }: EditorBubbleProps) {
	if (inCode || !allowsMark(editor.state, COLOR_MARK_NAME)) return null;
	return (
		<BubbleButton
			label={t("label")}
			onClick={() =>
				openPanel({
					label: t("label"),
					size: "auto",
					content: <TextColorPanel editor={editor} onPicked={closePanel} />,
				})
			}
		>
			<TextColorIcon editor={editor} />
		</BubbleButton>
	);
}

function ColorMenuItems({ editor }: { editor: Editor }) {
	return (
		<>
			<DropdownMenuSeparator className="first:hidden" />
			<TextColorMenuItems editor={editor} />
		</>
	);
}

/** 글자색 꾸밈의 편집기 등록. 색 뒤에 이어 친 글자는 색을 이어받지 않는다. */
export const colorMarkExtension: EditorMarkExtension = {
	render: colorMarkAttributes,
	toolbar: { group: "format", priority: 3, Button: TextColorMenu, MenuItems: ColorMenuItems },
	bubble: { group: "format", Button: ColorBubbleButton },
};

const components: CmsAdminComponents = { marks: { [colorBlock.name]: colorMarkExtension } };

/** 글자색 꾸밈의 편집기 표시·서식 도구·버블을 관리자 화면에 넣는다. */
export function ColorProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
