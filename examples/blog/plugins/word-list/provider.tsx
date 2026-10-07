"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { defineTextChecker, type TextIssue } from "@monti-cms/core/client";
import type { ReactNode } from "react";

/** A small checker that only looks at a banned-word list and runs in the browser (a free checker, so `auto: true` would be fine too). */
const WORDS: Readonly<Record<string, { readonly message: string; readonly suggestions: readonly string[] }>> = {
	alot: { message: "Write “a lot” as two words.", suggestions: ["a lot"] },
	teh: { message: "Possible typo.", suggestions: ["the"] },
	utilize: { message: "Prefer a simpler word.", suggestions: ["use"] },
};

const wordListChecker = defineTextChecker({
	id: "word-list",
	label: "Word list check",
	locales: ["en"],
	// Checks only on button press (default). It is a free checker that runs in the browser, so `auto: true` is fine too.
	check: async (segments) => {
		const issues: TextIssue[] = [];
		for (const segment of segments) {
			for (const match of segment.text.matchAll(/\p{L}+/gu)) {
				const rule = WORDS[match[0].toLowerCase()];
				if (!rule) continue;
				const start = match.index ?? 0;
				issues.push({
					segmentId: segment.id,
					start,
					end: start + match[0].length,
					message: rule.message,
					suggestions: rule.suggestions,
					severity: "warning",
					category: "style",
					ruleId: match[0].toLowerCase(),
				});
			}
		}
		return issues;
	},
});

const components: CmsAdminComponents = { textCheckers: [wordListChecker] };

/** Wraps the admin UI (the provider of the plugin's admin side) and hands it the checker. */
export function WordListProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
