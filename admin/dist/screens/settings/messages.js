import { defineMessages } from "@monti-cms/core";
/** Text of the Settings page: its title and the tab names . */
export const settingsMessages = defineMessages("cms-admin.settings", {
    en: {
        title: "Settings",
        description: "Saved to monti.schema.ts. Review your changes, then save them all at once.",
        "tabs.label": "Settings sections",
        "tab.collections": "Collections",
        "tab.locales": "Languages",
        "tab.site": "Site",
        "tab.admin": "Admin",
        "tab.data": "Data",
        "data.description": "What the site holds, apart from its schema file. Nothing here needs saving.",
    },
    ko: {
        title: "설정",
        description: "monti.schema.ts에 저장돼요. 바꾼 내용은 검토한 뒤 한 번에 저장해요.",
        "tabs.label": "설정 구역",
        "tab.collections": "컬렉션",
        "tab.locales": "언어",
        "tab.site": "사이트",
        "tab.admin": "관리자",
        "tab.data": "데이터",
        "data.description": "스키마 파일과 별개로 사이트가 담고 있는 내용이에요. 여기서는 저장할 것이 없어요.",
    },
});
