import { defineMessages } from "../../i18n/define";

/** 로그인 방식의 버튼 문구(M15). 사이트는 설정의 `admin.messages["cms.auth"]`로 덮어쓴다. */
export const authMessages = defineMessages("cms.auth", {
	en: { "github.label": "Sign in with GitHub" },
	ko: { "github.label": "GitHub으로 로그인" },
});
