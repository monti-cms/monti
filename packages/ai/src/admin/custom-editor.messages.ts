import { defineMessages } from "@monti-cms/core";

/** 화면 기능의 기본 정보 입력(이름·붙을 곳·결과·방식)의 문구(M15). */
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
