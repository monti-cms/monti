import { defineMessages } from "../../i18n/define";

/**
 * Translation check reason messages. Keys are `StructureCheck`'s `code` (`mdx_error` puts the MDX parse error in `{message}`).
 * Sites override them with `admin.messages["cms.translation"]` in the config.
 */
export const translationMessages = defineMessages("cms.translation", {
	en: {
		mdx_error: "MDX error: {message}",
		source_unreadable: "The source can't be read.",
		structure_changed: "The structure (elements, links, code, attributes) differs from the source.",
		unreadable: "can't be read",
	},
	ko: {
		mdx_error: "MDX 오류: {message}",
		source_unreadable: "원문을 읽을 수 없습니다.",
		structure_changed: "원문과 구조(요소·링크·코드·속성)가 달라졌습니다.",
		unreadable: "읽을 수 없습니다.",
	},
});
