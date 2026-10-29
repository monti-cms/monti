"use client";

import { Information, ViewOff, Warning, WarningAlt } from "@carbon/icons-react";
import type { TextIssueSeverity } from "@monti-cms/core";
import { useTranslator } from "@monti-cms/core/site";
import type { MontiIcon } from "@monti-cms/ui";
import { Button, Icon, Inline, Popover, PopoverContent, Text, TextButton } from "@monti-cms/ui";
import { posToDOMRect } from "@tiptap/core";
import { useMemo, useRef } from "react";
import { commonMessages } from "../../lib/common.messages";
import { textCheckMessages } from "./messages";
import { textCheckIssues } from "./plugin";
import type { DocTextIssue } from "./run";
import type { TextCheckController } from "./use-text-check";

const SEVERITY_ICON: Readonly<Record<TextIssueSeverity, { icon: MontiIcon; tone: "danger" | "warning" | "inherit" }>> =
	{
		error: { icon: Warning, tone: "danger" },
		warning: { icon: WarningAlt, tone: "warning" },
		info: { icon: Information, tone: "inherit" },
	};

function SeverityIcon({ severity }: { severity: TextIssueSeverity }) {
	const { icon, tone } = SEVERITY_ICON[severity];
	return <Icon icon={icon} tone={tone} />;
}

/** Result popup that appears at the spot when an underline is clicked or picked from the list: explanation, replacement candidates, ignore. */
export function TextIssuePopover({ controller }: { controller: TextCheckController }) {
	const t = useTranslator(textCheckMessages);
	const { editor, open, issues, pluginKey } = controller;
	const issue = open ? issues.find((item) => item.key === open.key) : undefined;
	const key = issue?.key;
	// A popup opened from the list (keyboard) returns focus to the body on close. A popup opened by clicking an underline did not move focus.
	const returnFocusRef = useRef(false);
	if (open) returnFocusRef.current = open.focus;
	// Underlines can be redrawn, so measure the position from the current document position instead of a DOM element.
	const anchor = useMemo(
		() =>
			key
				? {
						getBoundingClientRect: () => {
							const current = textCheckIssues(editor.state, pluginKey).find((item) => item.key === key);
							if (!current || editor.isDestroyed) return new DOMRect();
							try {
								return posToDOMRect(editor.view, current.from, current.to);
							} catch {
								return new DOMRect();
							}
						},
					}
				: null,
		[editor, key, pluginKey],
	);
	return (
		<Popover
			open={!!issue}
			onOpenChange={(next) => {
				if (!next) controller.close();
			}}
		>
			<PopoverContent
				anchor={anchor}
				side="bottom"
				align="start"
				initialFocus={open?.focus ?? false}
				finalFocus={() => (returnFocusRef.current ? (editor.view.dom as HTMLElement) : false)}
				aria-label={t("results")}
				width="md"
				scroll
			>
				{issue && <IssueCard controller={controller} issue={issue} />}
			</PopoverContent>
		</Popover>
	);
}

function IssueCard({ controller, issue }: { controller: TextCheckController; issue: DocTextIssue }) {
	const t = useTranslator(textCheckMessages);
	const tc = useTranslator(commonMessages);
	const checker = controller.checkers.find((item) => item.id === issue.checkerId);
	const editable = controller.editor.isEditable;
	return (
		<>
			<Inline align="start" gap={8}>
				<SeverityIcon severity={issue.severity} />
				<Text as="p">{issue.message || issue.text}</Text>
			</Inline>
			{issue.suggestions.length > 0 && (
				<Inline wrap gap={4}>
					{issue.suggestions.slice(0, 6).map((suggestion) => (
						<Button
							key={suggestion}
							type="button"
							variant="secondary"
							size="sm"
							disabled={!editable}
							onClick={() => controller.apply(issue, suggestion)}
						>
							{suggestion || tc("delete")}
						</Button>
					))}
				</Inline>
			)}
			<Inline gap={8}>
				<Inline grow minWidth={0}>
					<Text variant="caption" tone="muted" truncate>
						{checker?.label ?? issue.source}
					</Text>
				</Inline>
				{issue.url && (
					<TextButton variant="underline" href={issue.url} target="_blank" rel="noreferrer noopener">
						{t("explain")}
					</TextButton>
				)}
				<TextButton type="button" onClick={() => controller.ignore(issue)}>
					<ViewOff aria-hidden />
					{t("ignore")}
				</TextButton>
			</Inline>
		</>
	);
}
