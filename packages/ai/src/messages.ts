import { defineMessages } from "@monti-cms/core";

/** The assistant's words: why a run or a quick task could not go, and its activity rows. */
export const assistantMessages = defineMessages({
	namespace: "assistant",
	messages: {
		en: {
			"assistant.noKey": "There is no AI key.",
			"assistant.noModel": "That key has no such model.",
			"assistant.busy": "The assistant is still working in this conversation.",
			"assistant.noRun": "There is no such run.",
			"assistant.ended": "That run has ended.",
			"assistant.noConversation": "There is no such conversation.",
			"assistant.oneItem": "This request changes one proposed change, once.",
			"assistant.noImages": "This model does not read pictures.",
			"assistant.noPicture": "There is no such picture.",
			"assistant.noField": "This field cannot be filled.",
			"assistant.badAnswer": "The model's answer could not be read.",
			"conversations.keep": "Conversations kept for {days} days",
			"conversations.keepAll": "Conversations kept for good",
		},
		ko: {
			"assistant.noKey": "AI 키가 없습니다.",
			"assistant.noModel": "그 키에 없는 모델입니다.",
			"assistant.busy": "이 대화에서 아직 일하는 중입니다.",
			"assistant.noRun": "없는 실행입니다.",
			"assistant.ended": "끝난 실행입니다.",
			"assistant.noConversation": "없는 대화입니다.",
			"assistant.oneItem": "이 요청은 제안 하나를 한 번 바꿉니다.",
			"assistant.noImages": "그림을 읽지 못하는 모델입니다.",
			"assistant.noPicture": "없는 그림입니다.",
			"assistant.noField": "채울 수 없는 칸입니다.",
			"assistant.badAnswer": "모델의 답을 읽지 못했습니다.",
			"conversations.keep": "대화를 {days}일 동안 둠",
			"conversations.keepAll": "대화를 지우지 않음",
		},
	},
});
