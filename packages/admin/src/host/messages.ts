import { defineMessages } from "@monti-cms/core";

/** Messages for the admin layout (page title). */
export const layoutMessages = defineMessages("cms-admin.layout", {
	en: {
		title: "CMS Admin",
		titleWithSite: "CMS Admin | {site}",
		setupTitle: "Not set up yet",
		setupBody:
			"The admin cannot start because sign-in is not set up for this server. If this is your site, the server log says which setting is missing, and `monti doctor` lists everything that needs fixing and how.",
	},
	ko: {
		title: "CMS 관리자",
		titleWithSite: "CMS 관리자 | {site}",
		setupTitle: "아직 설정되지 않았습니다",
		setupBody:
			"이 서버에는 로그인이 설정되어 있지 않아 관리자를 시작할 수 없습니다. 내 사이트라면 서버 로그에 빠진 설정이 나오고, `monti doctor`가 고쳐야 할 것과 방법을 모두 보여 줍니다.",
	},
});
