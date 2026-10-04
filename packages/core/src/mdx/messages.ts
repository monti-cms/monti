import { defineMessages } from "../i18n/define";

/**
 * MDX 분석 오류 문구(M15). 키는 오류 `code`(`CmsMdxError.code`)이고 값 자리(`{name}` 등)는 오류의 `params`다.
 * 사이트는 설정의 `admin.messages["cms.mdx"]`로 덮어쓴다.
 */
export const mdxMessages = defineMessages("cms.mdx", {
	en: {
		spread_attribute: "Spread attributes aren't allowed in the body.",
		call_expression: "Function calls aren't allowed in the body.",
		identifier_reference: "Variable references aren't allowed in the body.",
		unsupported_expression: "Unsupported expression: {source}",
		retired_jsx_element: "Retired JSX element: {name}. Switch to the directive storage format (section 4.4).",
		disallowed_jsx_element: "JSX element not allowed: {name}",
		event_handler_attribute: "Event handler attributes aren't allowed: {name}",
		esm_not_allowed: "import/export isn't allowed in the body.",
		child_count_range: "{name} allows only {min}-{max} of {children}.",
		child_count_min: "{name} allows only {min} or more of {children}.",
		parse_failed: "The MDX syntax can't be parsed.",
	},
	ko: {
		spread_attribute: "본문에서 spread 속성은 허용되지 않습니다.",
		call_expression: "본문에서 함수 호출은 허용되지 않습니다.",
		identifier_reference: "본문에서 변수 참조는 허용되지 않습니다.",
		unsupported_expression: "지원하지 않는 표현식입니다: {source}",
		retired_jsx_element: "폐기된 JSX 요소입니다: {name} — directive 저장 형식으로 바꾸세요(§4.4).",
		disallowed_jsx_element: "허용되지 않은 JSX 요소입니다: {name}",
		event_handler_attribute: "이벤트 핸들러 속성은 허용되지 않습니다: {name}",
		esm_not_allowed: "본문에서 import/export는 허용되지 않습니다.",
		child_count_range: "{name}는 {min}~{max}개의 {children}만 허용합니다.",
		child_count_min: "{name}는 {min}개 이상의 {children}만 허용합니다.",
		parse_failed: "MDX 구문을 분석할 수 없습니다.",
	},
});
