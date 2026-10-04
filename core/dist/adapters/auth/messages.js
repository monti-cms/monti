import { defineMessages } from "../../i18n/define.js";
/** Button text for login methods. A site overrides it with `admin.messages["cms.auth"]` in its config. */
export const authMessages = defineMessages("cms.auth", {
    en: { "github.label": "Sign in with GitHub" },
    ko: { "github.label": "GitHub으로 로그인" },
});
