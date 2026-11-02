import { defineMessages } from "@monti-cms/core";

/** Texts of the AI settings: what the API keys screen says a key is used for, and errors of the quick-task model. */
export const settingsMessages = defineMessages("cms-ai.settings", {
	en: {
		"use.quick": "Quick tasks",
		"use.assistant": "Assistant",
		"use.default": "{model} · default",
		unknownKey: "This key doesn't exist or isn't for an AI service.",
		"snippet.textTooLong": "The text can be up to {max} characters.",
		"snippet.labelRequired": "Enter a name.",
		"snippet.labelTooLong": "The name can be up to {max} characters.",
		"snippet.keyFormat": "The key must start with a letter and use only letters, digits and _.",
		"snippet.unknown": "This shared text doesn't exist: {key}",
		"snippet.invalid": "The shared text is not in the right format.",
		"snippet.keyTaken": "This key is already used: {key}",
		"snippet.tooMany": "You can add up to {max} shared texts.",
		"snippet.configCannotDelete": "A shared text written in the config can't be deleted.",
		"snippet.inUse": "Actions use this shared text, so it can't be deleted: {users}",
	},
	ko: {
		"use.quick": "빠른 작업",
		"use.assistant": "어시스턴트",
		"use.default": "{model} · 기본",
		unknownKey: "없는 키이거나 AI 서비스의 키가 아니에요.",
		"snippet.textTooLong": "내용은 {max}자까지 쓸 수 있어요.",
		"snippet.labelRequired": "이름을 넣으세요.",
		"snippet.labelTooLong": "이름은 {max}자까지 쓸 수 있어요.",
		"snippet.keyFormat": "키는 영문자로 시작하고 영문자·숫자·_만 쓸 수 있어요.",
		"snippet.unknown": "없는 공용 문구예요: {key}",
		"snippet.invalid": "공용 문구 형식이 맞지 않아요.",
		"snippet.keyTaken": "이미 있는 키예요: {key}",
		"snippet.tooMany": "공용 문구는 {max}개까지 더할 수 있어요.",
		"snippet.configCannotDelete": "설정에 적은 공용 문구는 삭제할 수 없어요.",
		"snippet.inUse": "이 공용 문구를 쓰는 기능이 있어 삭제할 수 없어요: {users}",
	},
});
