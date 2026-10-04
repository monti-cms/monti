"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
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
import { cn } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { Code2, Unlink } from "lucide-react";
import type { ReactNode } from "react";
import { codeRefBlock } from "./definition";
import { codeRefMessages } from "./messages";

const t = createTranslator(codeRefMessages);

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
	if (inCode || !allowsMark(editor.state, CODE_REF_MARK) || !hasCodeBlock(editor)) return null;
	return (
		<BubbleButton
			label={t("link")}
			onClick={() => {
				const { from, to } = editor.state.selection;
				startLinkFromText(editor.view, from, to);
			}}
		>
			<Code2 aria-hidden className="size-4" />
		</BubbleButton>
	);
}

function CodeRefDetail({ editor, mark, act }: EditorMarkDetailProps) {
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
			<Code2 aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
			<span
				className={cn("max-w-56 truncate px-1 text-xs", where ? "text-cms-muted-foreground" : "text-cms-destructive")}
			>
				{where ? t("where", { where }) : t("none")}
			</span>
			<BubbleButton
				label={t("relink")}
				className="text-xs"
				onClick={act(() => startLinkFromText(editor.view, mark.from, mark.to))}
			>
				{t("relink.text")}
			</BubbleButton>
			<BubbleButton label={t("unlink")} onClick={act(() => unlinkRef(editor.view, mark.from, mark.to))}>
				<Unlink aria-hidden className="size-4" />
			</BubbleButton>
		</>
	);
}

/** Editor registration of the code-ref mark. Shown with an underline in the theme accent color. */
export const codeRefMarkExtension: EditorMarkExtension = {
	render: () => ({ class: "underline decoration-cms-primary/60 decoration-solid underline-offset-4" }),
	bubble: { group: "link", order: 1, Button: CodeRefBubbleButton },
	detail: CodeRefDetail,
};

const components: CmsAdminComponents = { marks: { [codeRefBlock.name]: codeRefMarkExtension } };

/** Registers the code-ref mark's editor display and bubble in the admin UI. */
export function CodeRefProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
