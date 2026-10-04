import { defineMessages } from "@monti-cms/core";
/** Login screen text. `provider` carries the name (e.g. GitHub) only when there is a single login method. */
export const loginMessages = defineMessages("cms-admin.login", {
    en: {
        title: "CMS Admin",
        description: ({ provider }) => `Sign in with an approved ${provider ? `${provider} ` : ""}admin account.`,
        forbiddenTitle: "No access",
        forbidden: ({ provider, accountId }) => `The ${provider ? `${provider} ` : ""}account ${accountId} doesn't have admin access.`,
        signOut: "Sign out",
        signIn: "Sign in with {provider}",
    },
    ko: {
        title: "CMS 관리자",
        description: ({ provider }) => `승인된 ${provider ? `${provider} ` : ""}관리자 계정으로 로그인해 주세요.`,
        forbiddenTitle: "접근 권한이 없습니다",
        forbidden: ({ provider, accountId }) => `로그인한 ${provider ? `${provider} ` : ""}계정 ${accountId}에는 관리자 권한이 없습니다.`,
        signOut: "로그아웃",
        signIn: "{provider} 계정으로 로그인",
    },
});
