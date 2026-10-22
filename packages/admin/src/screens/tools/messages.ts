import { defineMessages } from "@monti-cms/core";

/** Messages of a plugin's page in the Tools group. */
export const toolsMessages = defineMessages("cms-admin.tools", {
	en: {
		missingTitle: "This page is not set up",
		missingBody:
			'The plugin "{plugin}" has the sidebar item "{path}" but no page for it. Add a "{path}" page to the `pages` of its `defineAdminPlugin`.',
	},
	ko: {
		missingTitle: "이 페이지는 아직 준비되지 않았어요",
		missingBody:
			'플러그인 "{plugin}"에 사이드바 항목 "{path}"는 있지만 그 페이지가 없어요. 그 플러그인의 `defineAdminPlugin`의 `pages`에 "{path}" 페이지를 더하세요.',
	},
});
