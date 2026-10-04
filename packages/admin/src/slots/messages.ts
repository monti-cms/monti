import { defineMessages } from "@monti-cms/core";

/** 입력 자리 동작(AI 등) 결과 칸의 문구(M15). */
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
	},
});
