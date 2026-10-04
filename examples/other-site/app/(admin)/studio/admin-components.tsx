"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { defineTextChecker, type TextIssue } from "@monti-cms/core/client";
import type { ReactNode } from "react";

/**
 * 맞춤법·문장 검사 확장 예시. 본체는 검사기를 넣지 않는다. 여기서는 금지어 목록만 보는 작은 검사기를 브라우저에서 돌린다.
 * 키가 필요한 API는 `remoteTextChecker({ url })` + 서버 경로(`textCheckRoute`)로 붙인다(관리자 패키지 README "글 검사" 참고).
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
	// 버튼으로만 검사한다(기본). 브라우저 안에서 도는 무료 검사기라 `auto: true`로 켜도 된다.
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
