"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Button, Icon, Inline, Text } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Code2 } from "lucide-react";
import { commonMessages } from "../../lib/common.messages";
import type { TranslatorFor } from "../../translator";
import { codeEffectsKey } from "./effects-plugin";
import { cancelLink, commitLink, linkLines, linkTextRange } from "./link-commands";
import { codeBlockMessages } from "./messages";

const lineLabel = (t: TranslatorFor<typeof codeBlockMessages>, lines: { start: number; end: number }) =>
	lines.end - lines.start === 1
		? t("linkBar.line", { line: lines.start + 1 })
		: t("linkBar.lineRange", { start: lines.start + 1, end: lines.end });

/**
 * Guide line shown below the formatting tools while linking body text to code. Shows the side picked first, and turns on "Link" once the other side is picked.
 * Ends with Esc or "Cancel".
 */
export function CodeLinkBar({ editor }: { editor: Editor }) {
	const site = useSite();
	const t = useTranslator(codeBlockMessages);
	const tc = useTranslator(commonMessages);
	const status = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const state = current ? codeEffectsKey.getState(current.state) : undefined;
			if (!current || !state?.linking) return null;
			const text = linkTextRange(current.view);
			const lines = linkLines(current.view);
			return {
				kind: state.linking.kind,
				text: text ? current.state.doc.textBetween(text.from, text.to, " ") : null,
				lines: lines ? { start: lines.start, end: lines.end } : null,
			};
		},
	});
	if (!status) return null;

	const ready = !!status.text && !!status.lines;
	const quoted = status.text ? `“${status.text.length > 24 ? `${status.text.slice(0, 24)}…` : status.text}”` : "";

	return (
		<Inline
			role="status"
			aria-label={t("linkBar.label")}
			width="full"
			wrap
			justify="center"
			gap={8}
			border="top"
			background="selected"
			paddingX={16}
			paddingY={8}
		>
			<Icon icon={Code2} />
			<Text variant="caption">
				{status.kind === "text" ? (
					<>
						{t("linkBar.pickLinesBefore")}
						<Text weight="semibold">{quoted}</Text>
						{t("linkBar.pickLinesAfter")}
						{status.lines && <Text weight="semibold"> · {lineLabel(t, status.lines)}</Text>}
					</>
				) : (
					<>
						{t("linkBar.pickTextBefore")}
						<Text weight="semibold">
							{t("linkBar.codeLines", { lines: status.lines ? lineLabel(t, status.lines) : "" })}
						</Text>
						{t("linkBar.pickTextAfter")}
						{status.text && <Text weight="semibold"> · {quoted}</Text>}
					</>
				)}
			</Text>
			<Inline gap={4}>
				<Button
					type="button"
					size="xs"
					disabled={!ready}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => commitLink(site, editor.view)}
				>
					{t("linkBar.link")}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="xs"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => cancelLink(editor.view)}
				>
					{tc("cancel")}
				</Button>
			</Inline>
		</Inline>
	);
}
