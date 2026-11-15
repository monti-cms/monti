import { defineMessages } from "@monti-cms/core";

/** The assistant's words: why a run or a quick task could not go, and its activity rows. */
export const assistantMessages = defineMessages({
	namespace: "assistant",
	messages: {
		en: {
			"assistant.failed": "The AI could not do it: {reason}.",
			"assistant.noModel": "That key has no such model.",
			"assistant.busy": "The assistant is still working in this conversation.",
			"assistant.noRun": "There is no such run.",
			"assistant.ended": "That run has ended.",
			"assistant.notNewest": "This conversation has a newer request. Go on from that one.",
			"assistant.noConversation": "There is no such conversation.",
			"assistant.oneItem": "This request changes one proposed change, once.",
			"assistant.noField": "This field cannot be filled.",
			"assistant.badAnswer": "The model's answer could not be read.",
			"conversations.keep": "Unopened conversations deleted after {days} days",
			"conversations.keepAll": "Unopened conversations not deleted",
		},
		ko: {
			"assistant.failed": "AI 작업 실패: {reason}",
			"assistant.noModel": "그 키에 없는 모델입니다.",
			"assistant.busy": "이 대화에서 아직 일하는 중입니다.",
			"assistant.noRun": "없는 실행입니다.",
			"assistant.ended": "끝난 실행입니다.",
			"assistant.notNewest": "이 대화에 더 새 요청이 있습니다.",
			"assistant.noConversation": "없는 대화입니다.",
			"assistant.oneItem": "이 요청은 제안 하나를 한 번 바꿉니다.",
			"assistant.noField": "채울 수 없는 칸입니다.",
			"assistant.badAnswer": "모델의 답을 읽지 못했습니다.",
			"conversations.keep": "안 연 대화 지우기: {days}일 뒤",
			"conversations.keepAll": "안 연 대화 지우기: 지우지 않음",
		},
	},
});
