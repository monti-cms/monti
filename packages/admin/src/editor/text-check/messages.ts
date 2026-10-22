import { defineMessages } from "@monti-cms/core";

/** UI messages for the text check (spelling etc.) buttons, results, and notices. */
export const textCheckMessages = defineMessages("cms-admin.text-check", {
	en: {
		running: "Checking…",
		results: "Results",
		explain: "Details",
		ignore: "Ignore",
		nothingToCheck: "There is no text to check.",
		failed: "{label}: couldn't check.",
		nothingToFix: "Nothing to fix.",
	},
	ko: {
		running: "검사 중…",
		results: "검사 결과",
		explain: "설명",
		ignore: "무시",
		nothingToCheck: "검사할 글이 없어요.",
		failed: "{label}: 검사하지 못했어요.",
		nothingToFix: "고칠 곳이 없어요.",
	},
});
