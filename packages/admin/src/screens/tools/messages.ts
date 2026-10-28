import { defineMessages } from "@monti-cms/core";

/** Messages of the tools page: its title, its tabs, and a plugin's page in them. */
export const toolsMessages = defineMessages("cms-admin.tools", {
	en: {
		title: "Tools",
		"tabs.label": "Tool pages",
		"tab.templates": "Templates",
		"tab.data": "Data",
		"tab.events": "Activity log",
		"tab.apiKeys": "API keys",
		failedCount: "{count} failed deliveries",
		missingTitle: "This page is not set up",
		missingBody:
			'The plugin "{plugin}" has the sidebar item "{path}" but no page for it. Add a "{path}" page to the `pages` of its `defineAdminPlugin`.',
	},
	ko: {
		title: "도구",
		"tabs.label": "도구 구역",
		"tab.templates": "템플릿",
		"tab.data": "데이터",
		"tab.events": "활동 기록",
		"tab.apiKeys": "API 키",
		failedCount: "전송 실패 {count}건",
		missingTitle: "이 페이지는 아직 준비되지 않았어요",
		missingBody:
			'플러그인 "{plugin}"에 사이드바 항목 "{path}"는 있지만 그 페이지가 없어요. 그 플러그인의 `defineAdminPlugin`의 `pages`에 "{path}" 페이지를 더하세요.',
	},
});
