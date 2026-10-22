"use client";

import { type AdminComponents, useSite, useTranslator } from "@monti-cms/admin";
import {
	addedMarkName,
	allowsMark,
	BubbleButton,
	type EditorBubbleProps,
	type EditorMarkDetailProps,
	type EditorMarkExtension,
	findAnchor,
	startLinkFromText,
	unlinkRef,
} from "@monti-cms/admin/editor";
import { Box, Text } from "@monti-cms/admin/kit";
import type { Editor } from "@tiptap/core";
import { Code2, Unlink } from "lucide-react";
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

function CodeRefBubbleButton({ editor, inCode }: EditorBubbleProps) {
	const t = useTranslator(codeRefMessages);
	if (inCode || !allowsMark(editor.state, CODE_REF_MARK) || !hasCodeBlock(editor)) return null;
	return (
		<BubbleButton
			label={t("link")}
			onClick={() => {
				const { from, to } = editor.state.selection;
				startLinkFromText(editor.view, from, to);
			}}
		>
			<Code2 aria-hidden />
		</BubbleButton>
	);
}

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
			<Box as="span" paddingX="tight" shrink={false}>
				<Text tone="muted">
					{/* design-system: needs an Icon part (size and tone for an icon outside a button) */}
					<Code2 aria-hidden size={16} />
				</Text>
			</Box>
			<Box paddingX="tight" maxWidth="panel-sm">
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
export const codeRefMarkExtension: EditorMarkExtension = {
	render: () => ({ class: "underline decoration-monti-accent decoration-solid underline-offset-4" }),
	bubble: { group: "link", order: 1, Button: CodeRefBubbleButton },
	detail: CodeRefDetail,
};

/** The code-ref mark's editor display and bubble. */
export const codeRefComponents: AdminComponents = { marks: { [codeRefBlock.name]: codeRefMarkExtension } };
