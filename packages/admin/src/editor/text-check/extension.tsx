"use client";

import type { TextChecker } from "@monti-cms/core";
import { useSite } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import { useState } from "react";
import type { EditorExtensionContext, EditorExtensionResult } from "../../admin-components";
import type { EditorStatus } from "../../screens/shared/status-bar";
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
): EditorExtensionResult & { readonly textIssues: EditorStatus["textIssues"] } {
	const site = useSite();
	const [editor, setEditor] = useState<Editor | null>(null);
	const locale = context.getEntry?.().locale ?? site.DEFAULT_LOCALE;
	const controller = useTextCheck(editor, { checkers, locale });
	return {
		onEditor: setEditor,
		toolbar: controller ? <TextCheckToolbar controller={controller} /> : null,
		overlay: controller ? <TextIssuePopover controller={controller} /> : null,
		// What the status bar shows: how many findings there are, and a way to the first one.
		textIssues: controller
			? {
					count: controller.issues.length,
					jumpToFirst: () => {
						const first = controller.issues[0];
						if (first) controller.jump(first);
					},
					items: controller.issues.map((issue) => ({
						text: issue.text,
						suggestion: issue.suggestions[0] ?? null,
						jump: () => controller.jump(issue),
					})),
					// Checks with every checker of the language, one after the other (a check cancels the one before it).
					recheck: async () => {
						for (const checker of controller.checkers) await controller.run(checker.id);
					},
					checking: controller.running !== null,
				}
			: null,
	};
}
