import { defineMessages } from "@monti-cms/core";

/** Auxiliary messages for shared UI parts (`ui/*`): screen reader names and default labels. */
export const uiMessages = defineMessages("cms-admin.ui", {
	en: {
		close: "Close",
		clear: "Clear",
		deselect: "Remove",
		"pagination.label": "Pagination",
		"pagination.previous": "Previous",
		"pagination.previousPage": "Previous page",
		"pagination.next": "Next",
		"pagination.nextPage": "Next page",
		"pagination.more": "More pages",
		"sidebar.title": "Sidebar",
		"sidebar.description": "Shows the mobile sidebar.",
		"sidebar.toggle": "Toggle sidebar",
		"theme.toLight": "Switch to light mode",
		"theme.toDark": "Switch to dark mode",
	},
	ko: {
		close: "닫기",
		clear: "지우기",
		deselect: "선택 해제",
		"pagination.label": "페이지 이동",
		"pagination.previous": "이전",
		"pagination.previousPage": "이전 페이지",
		"pagination.next": "다음",
		"pagination.nextPage": "다음 페이지",
		"pagination.more": "다른 페이지",
		"sidebar.title": "사이드바",
		"sidebar.description": "모바일 사이드바를 보여 줍니다.",
		"sidebar.toggle": "사이드바 열고 닫기",
		"theme.toLight": "라이트 모드로 전환",
		"theme.toDark": "다크 모드로 전환",
	},
});
