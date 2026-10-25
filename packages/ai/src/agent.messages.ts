import { defineMessages } from "@monti-cms/core";

/** Messages of the admin agent: why it cannot run, and what its stored conversations say about themselves. */
export const agentMessages = defineMessages("cms-ai.agent", {
	en: {
		noConnection: "The assistant needs an AI connection.",
		"noConnection.fix": "Add a connection with a key and a model in the AI settings.",
		connectionNotReady: "The connection chosen for the assistant can't be used.",
		"connectionNotReady.fix": "Check its address, key and model in the AI settings, or choose another connection.",
		noTools: "The model {model} can't call tools, so the assistant is off for it.",
		"noTools.fix": "Choose another model for the assistant. AI actions keep working with this model.",
		unknownRun: "This conversation doesn't exist.",
		runTooLong: "This conversation is too long to continue.",
		"runTooLong.fix": "Start a new conversation.",
	},
	ko: {
		noConnection: "어시스턴트를 쓰려면 AI 연결이 필요해요.",
		"noConnection.fix": "AI 설정에서 키와 모델이 있는 연결을 추가하세요.",
		connectionNotReady: "어시스턴트에 고른 연결을 쓸 수 없어요.",
		"connectionNotReady.fix": "AI 설정에서 주소, 키, 모델을 확인하거나 다른 연결을 고르세요.",
		noTools: "{model} 모델은 도구를 부를 수 없어서 어시스턴트를 끈 상태예요.",
		"noTools.fix": "어시스턴트에 다른 모델을 고르세요. AI 동작은 이 모델로도 계속 쓸 수 있어요.",
		unknownRun: "없는 대화예요.",
		runTooLong: "대화가 너무 길어서 이어갈 수 없어요.",
		"runTooLong.fix": "새 대화를 시작하세요.",
	},
});
