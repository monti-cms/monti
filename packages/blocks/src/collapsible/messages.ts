import { defineMessages } from "@monti-cms/core";

/** 접기 블록의 이름표·설명과 편집 화면 문구(M15). */
export const collapsibleMessages = defineMessages("cms-blocks.collapsible", {
	en: {
		label: "Collapsible",
		description: "An area that opens when you click the title",
		"title.label": "Title",
		"defaultOpen.label": "Open by default",
		keywords: "expand,toggle,details",
		"insert.title": "Collapsible title",
		"insert.text": "Enter content",
		"toggle.close": "Collapse",
		"toggle.open": "Expand",
		"title.aria": "Collapsible title",
		"title.placeholder": "Expand",
		toolbar: "Collapsible tools",
	},
	ko: {
		label: "접기",
		description: "제목을 눌러 펼치는 영역",
		"title.label": "제목",
		"defaultOpen.label": "처음부터 펼치기",
		keywords: "접기,펼치기",
		"insert.title": "접기 제목",
		"insert.text": "내용을 입력하세요",
		"toggle.close": "접기",
		"toggle.open": "펼치기",
		"title.aria": "접기 제목",
		"title.placeholder": "펼치기",
		toolbar: "접기 도구",
	},
});
