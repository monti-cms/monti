"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { defineTextChecker, type TextIssue } from "@monti-cms/core/client";
import type { ReactNode } from "react";

/**
 * Example of a spelling and grammar check extension. The core ships no checker. Here a small checker that only looks at a banned-word list runs in the browser.
 * APIs that need a key attach through `remoteTextChecker({ url })` plus a server route (`textCheckRoute`) (see "Text checking" in the admin package README).
 */
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

export function SiteAdminComponents({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
