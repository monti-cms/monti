"use client";

import { type TextChecker, useSite } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { useState } from "react";
import type { EditorExtensionContext, EditorExtensionResult } from "../../admin-components";
import { TextCheckToolbar, TextIssuePopover } from "./text-check-controls";
import { useTextCheck } from "./use-text-check";

/**
 * Text check (spelling, etc.) UI. When an extension adds a checker to the admin extension point `textCheckers`, each checker gets a toolbar button,
 * and results are shown as wavy underlines, a results panel, and a list. The core has no checkers of its own, and if no checker
 * covers the text's language, it renders nothing.
 */
export function useTextCheckEditor(
	checkers: readonly TextChecker[],
	context: EditorExtensionContext,
): EditorExtensionResult {
	const site = useSite();
	const [editor, setEditor] = useState<Editor | null>(null);
	const locale = context.getEntry?.().locale ?? site.DEFAULT_LOCALE;
	const controller = useTextCheck(editor, { checkers, locale });
	return {
		onEditor: setEditor,
		toolbar: controller ? <TextCheckToolbar controller={controller} /> : null,
		overlay: controller ? <TextIssuePopover controller={controller} /> : null,
	};
}
