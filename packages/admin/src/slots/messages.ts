import { defineMessages } from "@monti-cms/core";

/** Messages for the result panel of input-slot actions (AI, etc.). */
export const slotsMessages = defineMessages("cms-admin.slots", {
	en: {
		failed: "Couldn't run it.",
		rerun: "Run again",
		close: "Close",
		instruction: "Extra request",
		run: "Run",
		running: "Running…",
		noResults: "No matching results.",
		insert: "Insert",
		replace: "Replace",
		unknownAction: "This action isn't available here.",
		nothingToApply: "There is no result to apply.",
		nothingToRerun: "There is nothing to run again.",
		cancelled: "Cancelled.",
	},
	ko: {
		failed: "실행하지 못했습니다.",
		rerun: "다시 실행",
		close: "닫기",
		instruction: "추가 요청",
		run: "실행",
		running: "실행 중…",
		noResults: "맞는 결과가 없습니다.",
		insert: "넣기",
		replace: "바꾸기",
		unknownAction: "여기서는 쓸 수 없는 동작입니다.",
		nothingToApply: "적용할 결과가 없습니다.",
		nothingToRerun: "다시 실행할 것이 없습니다.",
		cancelled: "취소했습니다.",
	},
});
