import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent } from "storybook/test";
import { ApiKeysScreen, MANY_KEYS } from "./api-keys";

/**
 * 기준 화면 · 도구 › API 키. 승인된 시안(v7 `keys7*.html`)을 `@monti-cms/ui` 부품과 지어낸 자료만으로 다시 그린 것이다. 관리자 앱이 아니다.
 * 키는 끝 네 글자만 보이는 가짜 값이다. 1440×900에서 시안과 견준다.
 */
const meta = {
	title: "Screens/API keys",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 시안처럼 목록의 첫 줄에 선다: 찾기 칸에서 ↓를 한 번 누른 것이다. */
const highlightFirst = async () => {
	await userEvent.keyboard("{ArrowDown}");
};

/** 시안 `keys7.html`: 키 셋과 두 쓰임의 모델. */
export const Keys: Story = { render: () => <ApiKeysScreen /> };
/** 시안 `keys7-many.html`: 키 아홉, 서비스가 거부한 키 하나, 긴 이름과 긴 주소. */
export const KeysMany: Story = { render: () => <ApiKeysScreen keys={MANY_KEYS} /> };
/** 시안 `keys7-empty.html`: 키가 없고, 모델은 고를 것이 없다. */
export const KeysEmpty: Story = { render: () => <ApiKeysScreen keys={[]} /> };
/** 시안 `keys7-add.html`: "키 추가"에서 서비스를 고르는 목록이 열려 있다. */
export const KeysAdd: Story = { render: () => <ApiKeysScreen add="pick" />, play: highlightFirst };
/** 시안 `keys7-add-search.html`: "deep"으로 찾은 서비스 둘. */
export const KeysAddSearch: Story = { render: () => <ApiKeysScreen add="search" />, play: highlightFirst };
/** 시안 `keys7-add-fail.html`: 서비스가 키를 받지 않았다. */
export const KeysAddFail: Story = { render: () => <ApiKeysScreen add="fail" /> };
