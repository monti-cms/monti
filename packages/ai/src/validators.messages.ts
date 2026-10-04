import { defineMessages } from "@monti-cms/core";

/** Names of code checks and the notes beside candidates (shown in the admin AI screen's check list and candidates). */
export const validatorMessages = defineMessages("cms-ai.validators", {
	en: {
		"uniqueSlug.label": "No duplicates",
		"regexRuns.label": "Regex runs",
		"regexRuns.detail": "{count} matches",
		"sameStructure.label": "Keep structure",
	},
	ko: {
		"uniqueSlug.label": "중복 없음",
		"regexRuns.label": "정규식 실행",
		"regexRuns.detail": "{count}곳",
		"sameStructure.label": "구조 유지",
	},
});
