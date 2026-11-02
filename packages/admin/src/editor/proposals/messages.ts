import { defineMessages } from "@monti-cms/core";

/** Text of the assistant's proposals in the editor: the bubble and the card of a mark. */
export const proposalMarksMessages = defineMessages("cms-admin.proposal-marks", {
	en: {
		previous: "Previous proposal",
		next: "Next proposal",
		discardAll: "Discard all",
		acceptAll: "Accept all",
		discard: "Discard",
		accept: "Accept",
		me: "Me",
		where: "Request · {block}",
		"block.paragraph": "paragraph {n}",
		"block.heading": "heading {n}",
		"block.other": "block {n}",
	},
	ko: {
		previous: "이전 제안",
		next: "다음 제안",
		discardAll: "모두 버리기",
		acceptAll: "모두 받기",
		discard: "버리기",
		accept: "받기",
		me: "나",
		where: "요청 · {block}",
		"block.paragraph": "문단 {n}",
		"block.heading": "제목 {n}",
		"block.other": "블록 {n}",
	},
});
