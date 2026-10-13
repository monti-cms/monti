import { defineMessages } from "@monti-cms/core";

/** Text of the admin tab of the schema screen. */
export const schemaAdminMessages = defineMessages("cms-admin.schema.admin", {
	en: {
		"admin.languageTitle": "Admin language",
		"admin.languageDescription": "The language of the admin itself.",
		"admin.featuresTitle": "Features",
		"admin.featuresDescription": "Parts of the admin you can turn off.",
		"admin.addressTitle": "Admin address",
		"admin.addressDescription": "Where the admin lives on the site.",
		"admin.locale": "Admin language",
		"admin.localeHint": "The language of the admin menus and buttons, and how dates and numbers are written.",
		"admin.localeDefault": "Same as the default language ({code})",
		"admin.templates": "Body templates",
		"admin.templatesHint":
			"Turn off to hide the template menu in the editor, the sidebar link and the Templates screen.",
		"admin.translations": "Translations",
		"admin.translationsHint":
			"Turn off to hide language tabs, the language column and the language filter. A one-language site hides them anyway.",
		"admin.path": "Admin address",
		"admin.pathNote": "Change it in monti.schema.ts and move the admin route folder.",
	},
	ko: {
		"admin.languageTitle": "관리자 언어",
		"admin.languageDescription": "관리자 화면 자체의 언어예요.",
		"admin.featuresTitle": "기능",
		"admin.featuresDescription": "끌 수 있는 관리자 기능이에요.",
		"admin.addressTitle": "관리자 주소",
		"admin.addressDescription": "사이트에서 관리자가 있는 주소예요.",
		"admin.locale": "관리자 언어",
		"admin.localeHint": "관리자의 메뉴와 버튼 언어이며, 날짜와 숫자를 쓰는 방식도 따릅니다.",
		"admin.localeDefault": "기본 언어와 같음 ({code})",
		"admin.templates": "본문 템플릿",
		"admin.templatesHint": "끄면 편집기의 템플릿 메뉴, 사이드바 링크, 템플릿 화면이 숨겨집니다.",
		"admin.translations": "번역",
		"admin.translationsHint":
			"끄면 언어 탭, 언어 열, 언어 필터가 숨겨집니다. 언어가 하나인 사이트는 어차피 숨겨집니다.",
		"admin.path": "관리자 주소",
		"admin.pathNote": "monti.schema.ts에서 바꾸고 관리자 라우트 폴더도 옮기세요.",
	},
});
