import { defineMessages } from "@monti-cms/core";
/** Texts the plugin shows in the admin outside its own screen, in the admin language. */
export const settingsMessages = defineMessages("cms-git-sync.settings", {
    en: {
        keyLabel: "GitHub token",
        webhookLabel: "GitHub webhook secret",
    },
    ko: {
        keyLabel: "GitHub 토큰",
        webhookLabel: "GitHub 웹훅 비밀 값",
    },
});
