import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsSiteScreen } from "./settings";

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
