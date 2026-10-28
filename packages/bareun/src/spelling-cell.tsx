"use client";

import { useSite, useTranslator } from "@monti-cms/admin";
import { StatusBarPluginCell, useStatusBarContext } from "@monti-cms/admin/kit";
import { bareunMessages } from "./messages";

/**
 * The plugin's cell in the editor's status bar: what the spell check found in the body, one row per finding (what to change, where it is) with its fix,
 * and "Fix all" and the way to the key's settings under them. No cell while there is nothing to fix, nor where no checker covers the entry's language.
 */
export function SpellingCell() {
	const site = useSite();
	const t = useTranslator(bareunMessages);
	const issues = useStatusBarContext().textIssues;
	if (!issues || issues.count === 0) return null;
	return (
		<StatusBarPluginCell
			label={t("status.label")}
			findings={issues.items.map((item) => ({
				id: item.key,
				title: item.suggestion === null ? item.text : `${item.text} → ${item.suggestion}`,
				detail: t("status.where", { paragraph: item.paragraph, context: item.context }),
				onOpen: item.jump,
				...(item.fix ? { actionLabel: t("status.fix"), onAction: item.fix } : {}),
			}))}
			settings={{ label: t("status.settings"), href: site.adminHref("/api-keys") }}
			{...(issues.fixAll ? { fixAll: { label: t("status.fixAll"), onClick: issues.fixAll } } : {})}
		/>
	);
}
