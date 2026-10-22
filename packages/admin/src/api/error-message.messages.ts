import { defineMessages } from "@monti-cms/core";

/**
 * The errors the screen tells itself (offline, a preview, no media storage) and the heading of a list of issues.
 * The text of an error code comes from the server (`cms.core.errors`), and so does the text of each issue (`cms.core.issues`).
 */
export const apiErrorMessages = defineMessages("cms-admin.api-errors", {
	en: {
		mediaNotConfigured: "Media storage isn't configured.",
		validationFailedList: "Validation failed:",
		fallback: "Couldn't complete the request.",
		previewNoWrite: "This is a preview: nothing is saved.",
		network: "Check your network connection.",
	},
	ko: {
		mediaNotConfigured: "미디어 저장소가 설정되지 않았어요.",
		validationFailedList: "검증 실패:",
		fallback: "요청을 처리하지 못했어요.",
		previewNoWrite: "미리보기라서 저장되지 않아요.",
		network: "네트워크 연결을 확인하세요.",
	},
});
