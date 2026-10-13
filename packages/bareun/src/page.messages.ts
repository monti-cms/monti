import { defineMessages } from "@monti-cms/core";

/** Texts of the Spell check admin page. */
export const pageMessages = defineMessages("cms-bareun.page", {
	en: {
		description: "Bareun checks Korean text in the editor. Choose the API key it uses.",
		"load.failed": "Couldn't load the spell check settings.",
		"save.label": "Save",
		"save.failed": "Couldn't save.",
		"save.done": "Saved.",
	},
	ko: {
		description: "바른이 편집기의 한국어 글을 검사합니다. 사용할 API 키를 고르세요.",
		"load.failed": "맞춤법 검사 설정을 불러오지 못했습니다.",
		"save.label": "저장",
		"save.failed": "저장하지 못했습니다.",
		"save.done": "저장했습니다.",
	},
});
