import { defineMessages } from "@monti-cms/core";

/** 코드 검사의 이름과 후보 옆 설명(관리자 AI 화면의 검사 목록·후보에 보인다). */
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
