import { defineMessages } from "@monti-cms/core";

/** Texts of the AI screen's Shared text tab (the code calls them snippets). */
export const snippetMessages = defineMessages("cms-ai.admin.snippets", {
	en: {
		"error.load": "Couldn't load the shared text.",
		"list.label": "Shared text",
		"list.empty": "No shared text yet.",
		"empty.title": "Select a shared text",
		"detail.added": "Custom",
		"new.title": "New shared text",
		"field.name": "Name",
		"field.key": "Key",
		"field.content": "Content",
		"action.add": "Add shared text",
		"action.resetDefault": "Reset to default",
		"copy.label": "Copy",
		"copy.done": "Copied",
		"confirm.title": "Delete shared text",
		"confirm.description": "Delete '{name}'?",
	},
	ko: {
		"error.load": "공용 문구를 불러올 수 없어요.",
		"list.label": "공용 문구 목록",
		"list.empty": "공용 문구가 없어요.",
		"empty.title": "공용 문구를 고르거나 새로 추가하세요",
		"detail.added": "직접 만듦",
		"new.title": "새 공용 문구",
		"field.name": "이름",
		"field.key": "키",
		"field.content": "내용",
		"action.add": "공용 문구 추가",
		"action.resetDefault": "기본값으로",
		"copy.label": "복사",
		"copy.done": "복사했어요",
		"confirm.title": "공용 문구 삭제",
		"confirm.description": "'{name}'을(를) 삭제할까요?",
	},
});
