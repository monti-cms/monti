"use client";

import { useTranslator } from "@monti-cms/admin";
import { StatusBarItem, useStatusBarContext } from "@monti-cms/admin/kit";
import { bareunMessages } from "./messages";

/** Status bar item of the editor: how many spelling findings the body has right now. Clicking goes to the first one. Hidden when there are none. */
export function SpellingIssuesStatus() {
	const t = useTranslator(bareunMessages);
	const issues = useStatusBarContext().editor?.textIssues;
	if (!issues || issues.count === 0) return null;
	return (
		<StatusBarItem tone="warning" onClick={issues.jumpToFirst} title={t("status.title")}>
			{t("status.issues", { count: issues.count })}
		</StatusBarItem>
	);
}
