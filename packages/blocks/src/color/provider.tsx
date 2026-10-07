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

/** Text color display in the editor. The same `.cms-color` rule (`styles.css`, the same as `render.css` for the public page) picks the color for the theme. */
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

/** Editor registration of the text color mark. Text typed right after a colored run does not inherit the color. */
export const colorMarkExtension: EditorMarkExtension = {
	render: colorMarkAttributes,
	toolbar: { group: "format", priority: 3, Button: TextColorMenu, MenuItems: ColorMenuItems },
	bubble: { group: "format", Button: ColorBubbleButton },
};

const components: CmsAdminComponents = { marks: { [colorBlock.name]: colorMarkExtension } };

/** Registers the text color mark's editor display, format tool, and bubble in the admin UI. */
export function ColorProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
