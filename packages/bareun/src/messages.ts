import { defineMessages } from "@monti-cms/core";

/**
 * 바른 검사기의 기본 이름, 결과 분류 이름, 서버 오류 문구(M15). 결과 설명(`comment`)은 바른이 주는 한국어 글 그대로다.
 */
export const bareunMessages = defineMessages("cms-bareun", {
	en: {
		label: "Bareun spell check",
		"category.TYPO": "Typo",
		"category.SPACING": "Spacing",
		"category.STANDARD": "Standard word",
		"category.GRAMMER": "Grammar",
		"category.WORD": "Spelling",
		"category.FOREIGN_WORD": "Loanword spelling",
		"category.CONFUSABLE_WORDS": "Confusable words",
		"category.SENTENCE": "Sentence",
		"category.CONFIRM": "Needs review",
		"category.THINKING": "Worth a second look",
		"category.UNKNOWN": "Needs review",
		"issue.message": "{label}: {comment}",
		"error.keyMissing": "The Bareun API key is missing.",
	},
	ko: {
		label: "바른 맞춤법 검사",
		"category.TYPO": "오타",
		"category.SPACING": "띄어쓰기",
		"category.STANDARD": "표준어",
		"category.GRAMMER": "문법",
		"category.WORD": "맞춤법",
		"category.FOREIGN_WORD": "외래어 표기",
		"category.CONFUSABLE_WORDS": "헷갈리는 말",
		"category.SENTENCE": "문장",
		"category.CONFIRM": "확인 필요",
		"category.THINKING": "다시 생각해 볼 곳",
		"category.UNKNOWN": "확인 필요",
		"error.keyMissing": "바른 API 키가 없습니다.",
	},
});
