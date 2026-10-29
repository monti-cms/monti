"use client";

import { SpellCheck } from "@carbon/icons-react";
import type { TextChecker } from "@monti-cms/core";
import { useSite, useTranslator } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import { useState } from "react";
import type { EditorExtensionContext, EditorExtensionResult } from "../../admin-components";
import { useIconByName } from "../../screens/shared/collection-icon";
import { type TextIssues, textIssuesOf } from "./findings";
import { textCheckMessages } from "./messages";
import { TextIssuePopover } from "./text-check-controls";
import { useTextCheck } from "./use-text-check";

/**
 * Text check (spelling, etc.) UI. When an extension adds a checker to the admin extension point `textCheckers`, each checker gets a row in the
 * editor's ⋯ menu that runs it, and results are shown as wavy underlines, a results popup, and the status bar's plugin cell. The core has no checkers of its own, and if no checker
 * covers the text's language, it renders nothing.
 */
export function useTextCheckEditor(
	checkers: readonly TextChecker[],
	context: EditorExtensionContext,
): EditorExtensionResult & { readonly textIssues: TextIssues | null } {
	const site = useSite();
	const [editor, setEditor] = useState<Editor | null>(null);
	const locale = context.getEntry?.().locale ?? site.DEFAULT_LOCALE;
	const controller = useTextCheck(editor, { checkers, locale });
	const t = useTranslator(textCheckMessages);
	const iconByName = useIconByName();
	return {
		onEditor: setEditor,
		// One row per checker; a body that cannot be edited (the trash, a lock) has nothing to check against.
		menuItems:
			controller?.editor.isEditable === true
				? controller.checkers.map((checker) => {
						const Glyph = (typeof checker.icon === "string" ? iconByName(checker.icon) : checker.icon) ?? SpellCheck;
						return {
							key: `text-check:${checker.id}`,
							label: checker.label,
							icon: <Glyph aria-hidden />,
							caption: controller.running === checker.id ? t("running") : undefined,
							onSelect: () => {
								if (controller.running === null) void controller.run(checker.id);
							},
						};
					})
				: [],
		overlay: controller ? <TextIssuePopover controller={controller} /> : null,
		// What the status bar's plugin cell shows: each finding with its place and the way to fix it.
		textIssues: controller ? textIssuesOf(controller, locale) : null,
	};
}
