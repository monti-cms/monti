import { defineMessages } from "../../i18n/define";

/**
 * 코드 블록 효과의 이름표와 입력 검사 안내(M15). 줄 효과 이름표 키는 `lineEffect.<이름>`, 글자 효과는 `charEffect.<이름>`이다.
 * 사이트는 설정의 `admin.messages["cms.code-block"]`로 덮어쓴다.
 */
export const codeBlockMessages = defineMessages("cms.code-block", {
	en: {
		"lineEffect.highlight": "Highlight",
		"lineEffect.plus": "Added",
		"lineEffect.minus": "Removed",
		"lineEffect.warning": "Warning",
		"lineEffect.error": "Error",
		"charEffect.strong": "Bold",
		"charEffect.em": "Italic",
		"charEffect.del": "Strikethrough",
		"charEffect.u": "Underline",
		"charEffect.Tooltip": "Tooltip",
		"charEffect.fold": "Fold text",
		"pattern.empty": "Enter a regular expression.",
		"pattern.newline": "A regular expression can't contain a line break.",
		"pattern.flags": "Flags can only be g, i, m, s, u or y.",
		"pattern.invalid": "This isn't a valid regular expression.",
		"fold.minLines": "Select at least two lines to fold.",
		"fold.exists": "This range is already folded.",
		"fold.overlaps": "This overlaps another folded range.",
	},
	ko: {
		"lineEffect.highlight": "강조",
		"lineEffect.plus": "추가",
		"lineEffect.minus": "삭제",
		"lineEffect.warning": "경고",
		"lineEffect.error": "오류",
		"charEffect.strong": "굵게",
		"charEffect.em": "기울임",
		"charEffect.del": "취소선",
		"charEffect.u": "밑줄",
		"charEffect.Tooltip": "툴팁",
		"charEffect.fold": "글자 접기",
		"pattern.empty": "정규식을 입력하세요.",
		"pattern.newline": "정규식에 줄바꿈을 넣을 수 없습니다.",
		"pattern.flags": "플래그는 g·i·m·s·u·y만 쓸 수 있습니다.",
		"pattern.invalid": "올바르지 않은 정규식입니다.",
		"fold.minLines": "두 줄 이상 골라야 접을 수 있습니다.",
		"fold.exists": "이미 접은 범위입니다.",
		"fold.overlaps": "다른 접기 범위와 걸쳐 있습니다.",
	},
});
