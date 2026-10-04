import { defineMessages } from "@monti-cms/core";

/** Label and editing view text of the tooltip inline mark. */
export const tooltipMessages = defineMessages("cms-blocks.tooltip", {
	en: {
		label: "Tooltip",
		"content.label": "Description",
		"field.empty": "Enter a description.",
		"panel.label": "Edit tooltip",
		add: "Add tooltip",
		edit: "Edit tooltip",
		remove: "Remove tooltip",
		"insert.title": "Tooltip",
		"insert.description": "Add a note to text",
		"insert.keywords": "hint,note",
		"insert.text": "Tooltip text",
	},
	ko: {
		label: "툴팁",
		"content.label": "설명",
		"field.empty": "설명을 입력하세요.",
		"panel.label": "툴팁 편집",
		add: "툴팁 넣기",
		edit: "툴팁 수정",
		remove: "툴팁 해제",
		"insert.title": "툴팁",
		"insert.description": "글자에 설명 달기",
		"insert.keywords": "툴팁,설명,주석",
		"insert.text": "툴팁 텍스트",
	},
});
