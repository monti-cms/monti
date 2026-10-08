import { defineMessages } from "@monti-cms/core";

/** Login screen text. `provider` carries the name (e.g. GitHub) only when there is a single login method. */
export const loginMessages = defineMessages("cms-admin.login", {
	en: {
		title: "CMS Admin",
		description: ({ provider }) => `Sign in with an approved ${provider ? `${provider} ` : ""}admin account.`,
		forbiddenTitle: "No access",
		forbidden: ({ provider, accountId }) =>
			`The ${provider ? `${provider} ` : ""}account ${accountId} doesn't have admin access.`,
		signOut: "Sign out",
		signIn: "Sign in with {provider}",
		noLoginTitle: "No login configured",
		noLogin: "This site has no way to sign in to the admin yet. The site owner adds a login in monti.config.ts.",
	},
	ko: {
		title: "CMS 관리자",
		description: ({ provider }) => `승인된 ${provider ? `${provider} ` : ""}관리자 계정으로 로그인해 주세요.`,
		forbiddenTitle: "접근 권한이 없습니다",
		forbidden: ({ provider, accountId }) =>
			`로그인한 ${provider ? `${provider} ` : ""}계정 ${accountId}에는 관리자 권한이 없습니다.`,
		signOut: "로그아웃",
		signIn: "{provider} 계정으로 로그인",
		noLoginTitle: "로그인이 설정되지 않았습니다",
		noLogin:
			"이 사이트에는 아직 관리자 로그인 방법이 없습니다. 사이트 소유자가 monti.config.ts에 로그인을 추가해야 합니다.",
	},
});
