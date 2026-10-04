import { defineMessages } from "@monti-cms/core";

/** UI messages for editor blocks (custom blocks, code fence preview, math). */
export const blocksMessages = defineMessages("cms-admin.editor-blocks", {
	en: {
		"settings.label": "Settings",
		"added.toolbar": "{label} tools",
		"added.placeholder": "Enter {label}",
		"fence.editing": "Editing",
		"fence.selected": "Selected",
		"fence.sourceCode": "Source code",
		"fence.edit": "Edit {label}",
		"fence.enter": "Enter {label}",
		"preview.loadFailed": "Couldn't load the {label} preview. {error}",
		"preview.loading": "Loading {label}…",
		"math.label": "Math",
		"math.placeholder": "Enter a formula",
	},
	ko: {
		"settings.label": "설정",
		"added.toolbar": "{label} 도구",
		"added.placeholder": "{label}을(를) 입력하세요",
		"fence.editing": "편집 중",
		"fence.selected": "선택됨",
		"fence.sourceCode": "원문 코드",
		"fence.edit": "{label} 편집",
		"fence.enter": "{label} 입력",
		"preview.loadFailed": "{label} 미리보기를 불러오지 못했습니다. {error}",
		"preview.loading": "{label} 불러오는 중…",
		"math.label": "수식",
		"math.placeholder": "수식을 입력하세요",
	},
});
