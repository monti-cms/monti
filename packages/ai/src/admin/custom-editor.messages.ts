import { defineMessages } from "@monti-cms/core";

/** Texts of the basic-info inputs of a screen action (name, attach target, result, mode). */
export const customMessages = defineMessages("cms-ai.admin.custom", {
	en: {
		"field.name": "Name",
		"field.place": "Placement",
		"field.field": "Field",
		"field.result": "Result",
		"field.engine": "Mode",
		"place.field": "Next to a field",
		"place.media": "Media",
	},
	ko: {
		"field.name": "이름",
		"field.place": "붙을 곳",
		"field.field": "필드",
		"field.result": "결과",
		"field.engine": "방식",
		"place.field": "필드 옆",
		"place.media": "미디어",
	},
});
