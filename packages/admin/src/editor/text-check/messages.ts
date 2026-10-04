import { defineMessages } from "@monti-cms/core";

/** 글 검사(맞춤법 등) 버튼·결과·알림의 문구(M15). */
export const textCheckMessages = defineMessages("cms-admin.text-check", {
	en: {
		running: "Checking…",
		results: "Results",
		delete: "Delete",
		explain: "Details",
		ignore: "Ignore",
		nothingToCheck: "There is no text to check.",
		failed: "{label}: couldn't check.",
		nothingToFix: "Nothing to fix.",
	},
	ko: {
		running: "검사 중…",
		results: "검사 결과",
		delete: "삭제",
		explain: "설명",
		ignore: "무시",
		nothingToCheck: "검사할 글이 없습니다.",
		failed: "{label}: 검사하지 못했습니다.",
		nothingToFix: "고칠 곳이 없습니다.",
	},
});
