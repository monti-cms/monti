import { defineMessages } from "@monti-cms/core";

/** AI 기능 목록·저장·화면 기능(관리자 AI 화면이 만든 기능) 오류 문구. */
export const actionsMessages = defineMessages("cms-ai.actions", {
	en: {
		unknownAction: "This AI action doesn't exist.",
		invalidValue: "The value is not valid.",
		unknownPlaceholder: ({ name }) => `The prompt can only use locale inputs and shared texts as {{name}}: {{${name}}}`,
		invalidBase: "The basic information is not valid.",
		cannotDeleteCoded: "An action defined in code can't be deleted.",
		noDefaultForCustom: "An action you made has no default to go back to.",
		"surface.resultNotAllowed": "This result shape can't be used in this place.",
		"surface.decideChoicesOnly":
			"The decision method works only on fields with fixed choices (relation or select fields).",
		"surface.noBlock": "This block doesn't exist: {block}",
		"surface.noCollection": "This collection doesn't exist: {collection}",
		"surface.noField": "This field doesn't exist: {field}",
		"input.blockSource": "Block source",
	},
	ko: {
		unknownAction: "알 수 없는 AI 기능입니다.",
		invalidValue: "값이 올바르지 않습니다.",
		unknownPlaceholder: ({ name }) => `지시문에는 언어 입력과 공통 문구만 {{이름}}으로 넣을 수 있습니다: {{${name}}}`,
		invalidBase: "기본 정보가 올바르지 않습니다.",
		cannotDeleteCoded: "코드로 정한 기능은 지울 수 없습니다.",
		noDefaultForCustom: "직접 만든 기능은 되돌릴 기본값이 없습니다.",
		"surface.resultNotAllowed": "이 자리에서 쓸 수 없는 결과 모양입니다.",
		"surface.decideChoicesOnly": "판단 방식은 고를 값이 정해진 필드(관계·선택 필드)에서만 쓸 수 있습니다.",
		"surface.noBlock": "없는 블록입니다: {block}",
		"surface.noCollection": "없는 컬렉션입니다: {collection}",
		"surface.noField": "없는 필드입니다: {field}",
		"input.blockSource": "블록 원문",
	},
});
