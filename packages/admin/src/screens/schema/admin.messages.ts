import { defineMessages } from "@monti-cms/core";

/** Text of the admin tab of the schema screen. */
export const schemaAdminMessages = defineMessages("cms-admin.schema.admin", {
	en: {
		"admin.languageTitle": "Language",
		"admin.featuresTitle": "Features",
		"admin.addressTitle": "Address",
		"admin.locale": "Admin language",
		"admin.localeDefault": "Same as the default language ({code})",
		"admin.templates": "Body templates",
		"admin.translations": "Translations",
		"admin.pathNote": "Changed in monti.schema.ts, together with the admin route folder.",
	},
	ko: {
		"admin.languageTitle": "언어",
		"admin.featuresTitle": "기능",
		"admin.addressTitle": "주소",
		"admin.locale": "관리자 언어",
		"admin.localeDefault": "기본 언어와 같음 ({code})",
		"admin.templates": "본문 템플릿",
		"admin.translations": "번역",
		"admin.pathNote": "monti.schema.ts에서 바꾸고, 관리자 라우트 폴더도 함께 옮겨요.",
	},
});
