"use client";

import { TextColor } from "@carbon/icons-react";
import type { AdminComponents, Site, Translator } from "@monti-cms/admin";
import { allowsMark, type EditorMarkExtension, type MarkAttrs } from "@monti-cms/admin/editor";
import { cleanTextColor, textColorProps } from "./colors";
import { colorBlock } from "./definition";
import { COLOR_MARK_NAME, TextColorPanel } from "./menu";
import { colorMessages } from "./messages";

/** Text color display in the editor. The same `.monti-color` rule (`styles.css`, the same as `render.css` for the public page) picks the color for the theme. */
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

/** Editor registration of the text color mark, in the admin language `t` picks. Text typed right after a colored run does not inherit the color. */
export const colorMarkExtension = (
	t: Translator<keyof (typeof colorMessages)["messages"]["en"]>,
): EditorMarkExtension => ({
	render: colorMarkAttributes,
	formatItems: [
		{
			id: "color",
			label: t("label"),
			icon: TextColor,
			isAvailable: ({ editor, inCode }) => !inCode && allowsMark(editor.state, COLOR_MARK_NAME),
			isActive: (editor) => editor.isActive(COLOR_MARK_NAME),
			run: ({ editor, openPanel, closePanel }) =>
				openPanel({
					label: t("label"),
					size: "auto",
					content: <TextColorPanel editor={editor} onPicked={closePanel} />,
				}),
		},
	],
});

/** The text color mark's editor display, format row, and panel, in the admin language of the site. */
export const colorComponents = (site: Site): AdminComponents => ({
	marks: { [colorBlock.name]: colorMarkExtension(site.createTranslator(colorMessages)) },
});
