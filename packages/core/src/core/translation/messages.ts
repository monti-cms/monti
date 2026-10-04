import { defineMessages } from "../../i18n/define";

/**
 * 번역 검사 이유 문구(M15). 키는 `StructureCheck`의 `code`다(`mdx_error`는 `{message}`에 MDX 분석 오류가 들어간다).
 * 사이트는 설정의 `admin.messages["cms.translation"]`로 덮어쓴다.
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
