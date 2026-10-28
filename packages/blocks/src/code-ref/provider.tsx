"use client";

import { Code, Unlink } from "@carbon/icons-react";
import { type AdminComponents, type Site, type Translator, useSite, useTranslator } from "@monti-cms/admin";
import {
	addedMarkName,
	allowsMark,
	BubbleButton,
	type EditorMarkDetailProps,
	type EditorMarkExtension,
	findAnchor,
	startLinkFromText,
	unlinkRef,
} from "@monti-cms/admin/editor";
import { Box, Icon, Text } from "@monti-cms/admin/kit";
import type { Editor } from "@tiptap/core";
import { codeRefBlock } from "./definition";
import { codeRefMessages } from "./messages";

/** Editor mark name (`cmsCodeRef`). */
export const CODE_REF_MARK = addedMarkName(codeRefBlock.name);

/** Whether the document has a code block. If not, there is no line to link to, so `Code link` is hidden. */
const hasCodeBlock = (editor: Editor) => {
	let found = false;
	editor.state.doc.descendants((node) => {
		if (node.type.name === "codeBlock") found = true;
		return !found;
	});
	return found;
};

function CodeRefDetail({ editor, mark, act }: EditorMarkDetailProps) {
	const t = useTranslator(codeRefMessages);
	const site = useSite();
	const anchor = findAnchor(editor.state.doc, String(mark.attrs.to ?? ""));
	const where = anchor
		? `${anchor.title ? `${anchor.title} ` : ""}${
				anchor.end - anchor.start === 1
					? t("line.one", { line: anchor.start + 1 })
					: t("line.range", { from: anchor.start + 1, to: anchor.end })
			}`
		: null;
	return (
		<>
			<Box as="span" paddingX={4} shrink={false}>
				<Icon icon={Code} size="sm" tone="muted" />
			</Box>
			<Box paddingX={4} maxWidth="menu">
				<Text as="div" variant="caption" tone={where ? "muted" : "danger"} truncate>
					{where ? t("where", { where }) : t("none")}
				</Text>
			</Box>
			<BubbleButton label={t("relink")} onClick={act(() => startLinkFromText(editor.view, mark.from, mark.to))}>
				{t("relink.text")}
			</BubbleButton>
			<BubbleButton label={t("unlink")} onClick={act(() => unlinkRef(site, editor.view, mark.from, mark.to))}>
				<Unlink aria-hidden />
			</BubbleButton>
		</>
	);
}

/** Editor registration of the code-ref mark. Shown with an underline in the theme accent color. */
export const codeRefMarkExtension = (
	t: Translator<keyof (typeof codeRefMessages)["messages"]["en"]>,
): EditorMarkExtension => ({
	render: () => ({ class: "underline decoration-monti-strong decoration-solid underline-offset-4" }),
	formatItems: [
		{
			id: "code-ref",
			label: t("link"),
			icon: Code,
			// Not inside code, and only where a code block gives a line to link to.
			isAvailable: ({ editor, inCode }) => !inCode && allowsMark(editor.state, CODE_REF_MARK) && hasCodeBlock(editor),
			run: ({ editor }) => {
				const { from, to } = editor.state.selection;
				startLinkFromText(editor.view, from, to);
			},
		},
	],
	detail: CodeRefDetail,
});

/** The code-ref mark's editor display, format row and bubble content, in the admin language of the site. */
export const codeRefComponents = (site: Site): AdminComponents => ({
	marks: { [codeRefBlock.name]: codeRefMarkExtension(site.createTranslator(codeRefMessages)) },
});
