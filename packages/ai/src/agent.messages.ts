import { defineMessages } from "@monti-cms/core";

/** Messages of the admin agent: why it cannot run, and what its stored conversations say about themselves. */
export const agentMessages = defineMessages("cms-ai.agent", {
	en: {
		noKey: "There's no AI connection.",
		"noKey.fix": "Add an API key in Tools › API keys.",
		keyNotReady: "The key of the chosen model can't be used.",
		"keyNotReady.fix": "Check the key in Tools › API keys, or choose another model.",
		noTools: "The model {model} can't use tools, so the assistant can't run on it.",
		"noTools.fix": "Choose another model.",
		unknownRun: "This conversation doesn't exist.",
		runTooLong: "This conversation is too long to continue.",
		"runTooLong.fix": "Start a new conversation.",
	},
	ko: {
		noKey: "AI 연결이 없어요.",
		"noKey.fix": "도구 › API 키에서 키를 넣으세요.",
		keyNotReady: "고른 모델의 키를 쓸 수 없어요.",
		"keyNotReady.fix": "도구 › API 키에서 키를 확인하거나 다른 모델을 고르세요.",
		noTools: "{model} 모델은 도구를 못 써서 어시스턴트를 쓸 수 없어요.",
		"noTools.fix": "다른 모델을 고르세요.",
		unknownRun: "없는 대화예요.",
		runTooLong: "대화가 너무 길어서 이어갈 수 없어요.",
		"runTooLong.fix": "새 대화를 시작하세요.",
	},
});
