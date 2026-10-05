import { defineMessages } from "@monti-cms/core";

/** Label and editing view text of the code link inline mark, and the public page back-link label (`back`). */
export const codeRefMessages = defineMessages("cms-blocks.code-ref", {
	en: {
		label: "Code link",
		"to.label": "Code line to link",
		link: "Code link",
		"line.one": "line {line}",
		"line.range": "lines {from}–{to}",
		where: "Code {where}",
		none: "No linked code line",
		relink: "Relink code",
		"relink.text": "Relink",
		unlink: "Unlink code",
		back: "Go to the text that links here",
	},
	ko: {
		label: "코드 연결",
		"to.label": "연결할 코드 줄 이름",
		link: "코드 연결",
		"line.one": "{line}줄",
		"line.range": "{from}–{to}줄",
		where: "코드 {where}",
		none: "연결된 코드 줄이 없습니다",
		relink: "코드 다시 연결",
		"relink.text": "다시 연결",
		unlink: "코드 연결 해제",
		back: "이 코드를 가리키는 본문으로 이동",
	},
});
