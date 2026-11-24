import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent } from "storybook/test";
import { SettingsSiteScreen } from "./settings";
import { SettingsAdminScreen } from "./settings-admin";
import { SettingsLanguagesScreen } from "./settings-languages";

/**
 * 기준 화면 · 설정. 승인된 시안(v5 `settings-*.html`, v7.1의 시작선·끝선)을 `@monti-cms/ui` 부품과 지어낸 자료만으로 다시 그린 것이다. 관리자 앱이 아니다.
 * 1440×900에서 시안과 견준다.
 */
const meta = {
	title: "Screens/Settings",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 시안 `settings-site.html`: 비어 있는 이름과 말투, 주소에 언어 표시 "원문 언어만 빼고". */
export const SettingsSite: Story = { render: () => <SettingsSiteScreen /> };
/** 시안 `settings-site-dirty.html`: 저장이 거절되었다(이름이 60자를 넘음). 말투를 고치는 중이고 주소에 언어 표시는 "항상". */
export const SettingsSiteDirty: Story = { render: () => <SettingsSiteScreen dirty /> };
/** 시안 `settings-lang.html`: 원문 한국어와 번역 둘, English 줄의 ⋯ 메뉴가 열려 있다. */
export const SettingsLang: Story = {
	render: () => <SettingsLanguagesScreen />,
	// 시안처럼 메뉴의 첫 줄에 선다: 열린 메뉴에서 ↓를 한 번 누른 것이다.
	play: async () => {
		await userEvent.keyboard("{ArrowDown}");
	},
};
/** 시안 `settings-lang-source.html`: 번역 열하나, 원문을 English로 바꿀지 묻는 창. */
export const SettingsLangSource: Story = { render: () => <SettingsLanguagesScreen source /> };
/** 시안 `settings-admin.html`: 화면 언어, 본문 템플릿, 계정. */
export const SettingsAdmin: Story = { render: () => <SettingsAdminScreen /> };
/** 시안 `settings-toolbar.html`: 편집기 도구의 서식 막대, 기본값 그대로. */
export const SettingsToolbar: Story = { render: () => <SettingsAdminScreen tools={{ view: "bar" }} /> };
/** 시안 `settings-toolbar-hidden.html`: / 블록 메뉴, 숨긴 항목 둘(저장하지 않은 바뀐 곳). */
export const SettingsToolbarHidden: Story = { render: () => <SettingsAdminScreen tools={{ view: "menu" }} /> };
/** 시안 `settings-toolbar-drag.html`: 링크를 굵게 뒤로 끄는 중. 미리보기는 놓였을 때의 막대다. */
export const SettingsToolbarDrag: Story = {
	render: () => <SettingsAdminScreen tools={{ view: "bar", dragging: true }} />,
};
