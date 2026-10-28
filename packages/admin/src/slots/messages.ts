import { defineMessages } from "@monti-cms/core";

/** Messages of the actions attached to a field (AI, etc.): what a failed run says. */
export const slotsMessages = defineMessages("cms-admin.slots", {
	en: {
		failed: "Couldn't run it.",
		unknownAction: "This action isn't available here.",
		nothingToApply: "There is no result to apply.",
		cancelled: "Cancelled.",
	},
	ko: {
		failed: "실행하지 못했어요.",
		unknownAction: "여기서는 쓸 수 없는 동작이에요.",
		nothingToApply: "적용할 결과가 없어요.",
		cancelled: "취소했어요.",
	},
});
