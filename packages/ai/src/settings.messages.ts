import { defineMessages } from "@monti-cms/core";

/** Texts of the AI settings: what the API keys screen says a key is used for, and errors of the quick-task model. */
export const settingsMessages = defineMessages("cms-ai.settings", {
	en: {
		"use.quick": "Quick tasks",
		"use.assistant": "Assistant",
		"use.default": "{model} · default",
		unknownKey: "This key doesn't exist or isn't for an AI service.",
	},
	ko: {
		"use.quick": "빠른 작업",
		"use.assistant": "어시스턴트",
		"use.default": "{model} · 기본",
		unknownKey: "없는 키이거나 AI 서비스의 키가 아니에요.",
	},
});
