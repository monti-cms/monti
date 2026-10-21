"use client";

import { useTranslator } from "@monti-cms/admin";
import { StatusBarItem, StatusPopoverHeader, StatusPopoverRow, useStatusBarContext } from "@monti-cms/admin/kit";
import { bareunMessages } from "./messages";

/**
 * Status bar item of the editor: how many spelling findings the body has right now. Clicking opens the findings (the marked word and the first
 * suggestion); a row selects that finding in the body. Hidden when there are none.
 */
export function SpellingIssuesStatus() {
	const t = useTranslator(bareunMessages);
	const issues = useStatusBarContext().editor?.textIssues;
	if (!issues || issues.count === 0) return null;
	return (
		<StatusBarItem
			tone="warning"
			title={t("status.title")}
			popover={
				<>
					<StatusPopoverHeader
						title={t("status.popover.title")}
						action={issues.recheck ? { label: t("status.popover.recheck"), onClick: issues.recheck } : undefined}
					/>
					{issues.items.map((issue, index) => (
						<StatusPopoverRow
							// biome-ignore lint/suspicious/noArrayIndexKey: the same word can be marked twice; the list is rebuilt as a whole
							key={index}
							label={issue.text}
							value={issue.suggestion === null ? undefined : `→ ${issue.suggestion}`}
							onClick={issue.jump}
						/>
					))}
				</>
			}
		>
			{t("status.issues", { count: issues.count })}
		</StatusBarItem>
	);
}
