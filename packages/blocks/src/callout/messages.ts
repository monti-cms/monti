import { defineMessages } from "@monti-cms/core";

/** 콜아웃 블록의 이름표·설명과 편집 화면 문구(M15). */
export const calloutMessages = defineMessages("cms-blocks.callout", {
	en: {
		label: "Callout",
		description: "A highlighted box for notes and warnings",
		"variant.label": "Type",
		"option.note": "Note",
		"option.tip": "Tip",
		"option.info": "Info",
		"option.warning": "Warning",
		"option.danger": "Danger",
		"title.label": "Title",
		keywords: "alert,notice",
		"insert.text": "Enter content",
		"title.aria": "Callout title",
		toolbar: "Callout tools",
		"variant.button": "Callout type · {variant}",
	},
	ko: {
		label: "콜아웃",
		description: "참고·경고처럼 눈에 띄게 강조하는 상자",
		"variant.label": "종류",
		"option.note": "노트",
		"option.tip": "팁",
		"option.info": "정보",
		"option.warning": "경고",
		"option.danger": "위험",
		"title.label": "제목",
		keywords: "콜아웃,알림",
		"insert.text": "내용을 입력하세요",
		"title.aria": "콜아웃 제목",
		toolbar: "콜아웃 도구",
		"variant.button": "콜아웃 종류 · {variant}",
	},
});
