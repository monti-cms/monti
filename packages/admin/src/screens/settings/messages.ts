import { defineMessages } from "@monti-cms/core";

/** Text of the Settings page: its title and the tab names (core tabs; a plugin tab uses its own `nav` label). */
export const settingsMessages = defineMessages("cms-admin.settings", {
	en: {
		title: "Settings",
		"tabs.label": "Settings sections",
		"tab.collections": "Collections",
		"tab.locales": "Locales",
		"tab.site": "Site",
		"tab.admin": "Admin",
		"tab.file": "File",
		"tab.templates": "Templates",
		"tab.events": "Event log",
		"tab.eventsBadge": "{count} failed event deliveries",
	},
	ko: {
		title: "설정",
		"tabs.label": "설정 구역",
		"tab.collections": "컬렉션",
		"tab.locales": "언어",
		"tab.site": "사이트",
		"tab.admin": "관리자",
		"tab.file": "파일",
		"tab.templates": "템플릿",
		"tab.events": "이벤트 기록",
		"tab.eventsBadge": "실패한 이벤트 전달 {count}건",
	},
});
