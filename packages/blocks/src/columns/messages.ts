import { defineMessages } from "@monti-cms/core";

/** 단 나누기 블록의 이름표·설명과 편집 화면 문구(M15). */
export const columnsMessages = defineMessages("cms-blocks.columns", {
	en: {
		label: "Columns",
		description: "Place content side by side in 2 to 4 columns",
		"widths.label": "Column widths",
		"widths.description": "Percentage per column, separated by commas (e.g. 60,40). Empty splits evenly.",
		keywords: "column,layout",
		"insert.text": "Enter content",
		"column.label": "Single column",
		resize: "Resize between column {from} and column {to}",
		toolbar: "Columns tools",
		count: "{count} columns",
		equalize: "Equal column widths",
		add: "Add column",
		deleteLast: "Delete last column",
		delete: "Delete this column",
	},
	ko: {
		label: "단 나누기",
		description: "내용을 2~4단으로 나란히 놓는다",
		"widths.label": "단 너비",
		"widths.description": "단마다 비율(%)을 쉼표로 적는다(예: 60,40). 비우면 똑같이 나눈다.",
		keywords: "단,나란히",
		"insert.text": "내용을 입력하세요",
		"column.label": "단 하나",
		resize: "{from}번째와 {to}번째 단 사이 너비 조절",
		toolbar: "단 나누기 도구",
		count: "{count}단",
		equalize: "단 너비 똑같이 나누기",
		add: "단 추가",
		deleteLast: "마지막 단 삭제",
		delete: "이 단 삭제",
	},
});
