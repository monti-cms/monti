import { defineMessages } from "@monti-cms/core";

/** Text of the admin tab of the schema screen. */
export const schemaAdminMessages = defineMessages("cms-admin.schema.admin", {
	en: {
		"admin.languageTitle": "Admin language",
		"admin.featuresTitle": "Features",
		"admin.addressTitle": "Admin address",
		"admin.locale": "Admin language",
		"admin.localeDefault": "Same as the default language ({code})",
		"admin.templates": "Body templates",
		"admin.translations": "Translations",
		"admin.path": "Admin address",
		"admin.pathNote": "Change it in monti.schema.ts and move the admin route folder.",
	},
	ko: {
		"admin.languageTitle": "관리자 언어",
		"admin.featuresTitle": "기능",
		"admin.addressTitle": "관리자 주소",
		"admin.locale": "관리자 언어",
		"admin.localeDefault": "기본 언어와 같음 ({code})",
		"admin.templates": "본문 템플릿",
		"admin.translations": "번역",
		"admin.path": "관리자 주소",
		"admin.pathNote": "monti.schema.ts에서 바꾸고 관리자 라우트 폴더도 옮기세요.",
	},
});
