import type { Meta, StoryObj } from "@storybook/react-vite";
import { PanelExtremeScreen, PanelScreen, PanelStatesBoard } from "./panel";

/**
 * 기준 화면 · 글의 속성 패널. 승인된 시안(v5 `panel.html` · `panel-states.html` · `panel-extreme.html`)을 `@monti-cms/ui` 부품과 지어낸 자료만으로
 * 다시 그린 것이다. 관리자 앱이 아니다. 패널은 360px, 양옆 24px이고 라벨은 왼쪽 열(72px)에 선다. 입력 칸은 쉴 때 밑줄이 없고 포인터와 포커스에만
 * 밑줄이 선다. 1440×900에서 시안과 견주고(상태 모음은 1560 폭도), 화면마다 어두운 바탕(`…Dark`)이 있다.
 */
const meta = {
	title: "Screens/Panel",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 시안 `panel.html`: 편집기 옆의 속성 패널. 주제 목록이 열려 있고, 관계 · 형식 · 검색·공유는 접혀 요약만 보인다. */
export const Panel: Story = { render: () => <PanelScreen /> };

/** 시안 `panel-states.html`: 새 글 · 채운 값 · 태그 고르기 · 관계·형식·검색의 네 장면. 1440 폭에서는 패널이 330px로 좁아진다. */
export const PanelStates: Story = { render: () => <PanelStatesBoard /> };

/** 시안 `render-v5-keep/panel-states-1560.png`: 같은 판을 1560 폭에서, 패널마다 제 폭 360px로. */
export const PanelStates1560: Story = {
	render: () => <PanelStatesBoard />,
	globals: { viewport: { value: "wide", isRotated: false } },
	parameters: {
		viewport: { options: { wide: { name: "1560 × 900", styles: { width: "1560px", height: "900px" } } } },
	},
};

/** 시안 `panel-extreme.html`: 긴 주소 · 요약 · 연재, 태그 아홉과 "+11", 줄을 바꾸는 긴 라벨, 많은 첨부 파일과 관련 글. */
export const PanelExtreme: Story = { render: () => <PanelExtremeScreen /> };

const dark = { globals: { theme: "dark" } };

export const PanelDark: Story = { ...Panel, ...dark };
export const PanelStatesDark: Story = { ...PanelStates, ...dark };
export const PanelStates1560Dark: Story = {
	...PanelStates1560,
	globals: { ...PanelStates1560.globals, theme: "dark" },
};
export const PanelExtremeDark: Story = { ...PanelExtreme, ...dark };
