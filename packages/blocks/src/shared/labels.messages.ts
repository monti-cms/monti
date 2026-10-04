import { defineMessages } from "@monti-cms/core";

/**
 * 공개 화면 블록이 독자에게 보이는 고정 문구(M15). 관리자 언어가 아니라 글(콘텐츠) 언어로 고른다(`context.locale`).
 * 차트 문법 오류 문구는 `chart/messages`에 있다.
 */
export const publicLabelMessages = defineMessages("cms-blocks.public", {
	en: {
		calloutNote: "Note",
		calloutTip: "Tip",
		calloutInfo: "Info",
		calloutWarning: "Warning",
		calloutDanger: "Danger",
		collapsibleFallback: "Show more",
	},
	ko: {
		calloutNote: "노트",
		calloutTip: "팁",
		calloutInfo: "정보",
		calloutWarning: "경고",
		calloutDanger: "위험",
		collapsibleFallback: "펼치기",
	},
	ja: {
		calloutNote: "ノート",
		calloutTip: "ヒント",
		calloutInfo: "情報",
		calloutWarning: "警告",
		calloutDanger: "危険",
		collapsibleFallback: "開く",
	},
});
