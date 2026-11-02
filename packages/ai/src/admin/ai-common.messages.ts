import { defineMessages } from "@monti-cms/core";

/** Texts shared by the AI button, model list, AI run requests and the test input fields. */
export const aiCommonMessages = defineMessages("cms-ai.admin.common", {
	en: {
		runFailed: "Couldn't run.",
		running: "Running…",
		listFailed: "Couldn't load the AI actions.",
		streamCut: "The AI answer was cut off before it finished.",
	},
	ko: {
		runFailed: "실행하지 못했어요.",
		running: "실행 중…",
		listFailed: "AI 기능 목록을 불러올 수 없어요.",
		streamCut: "AI 답이 끝나기 전에 끊겼어요.",
	},
});
