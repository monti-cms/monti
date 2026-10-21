import { defineMessages } from "@monti-cms/core";

/** Text of the Settings page: its title and the tab names . */
export const settingsMessages = defineMessages("cms-admin.settings", {
	en: {
		title: "Settings",
		description: "Saved to monti.schema.ts. Review your changes, then save them all at once.",
		"tabs.label": "Settings sections",
		changed: "changed",
		"tab.collections": "Collections",
		"tab.locales": "Languages",
		"tab.site": "Site",
		"tab.admin": "Admin",
	},
	ko: {
		title: "설정",
		description: "monti.schema.ts에 저장돼요. 바꾼 내용은 검토한 뒤 한 번에 저장해요.",
		"tabs.label": "설정 구역",
		changed: "바뀜",
		"tab.collections": "컬렉션",
		"tab.locales": "언어",
		"tab.site": "사이트",
		"tab.admin": "관리자",
	},
});
