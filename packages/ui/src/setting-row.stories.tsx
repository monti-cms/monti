import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Logout, TrashCan } from "./icons";
import { LetterMark } from "./key-list";
import { SettingRow } from "./setting-row";
import { Stack } from "./stack";
import { Switch } from "./switch";

/** 설정 한 줄: 이름과 풀이, 끝에 스위치나 버튼. 지우는 일은 위험색 테두리 상자. */
const meta = {
	title: "Patterns/Frame/SettingRow",
	component: SettingRow,
	decorators: [
		(Story) => (
			<Stack className="max-w-2xl">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof SettingRow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 스위치 줄: 스위치는 이름 줄에 선다. */
export const Switched: Story = {
	args: {
		title: "본문 템플릿",
		description: "편집기의 / 메뉴에서 미리 만든 본문을 넣습니다. 끄면 ‘도구 › 템플릿’도 숨겨집니다.",
		control: <Switch checked aria-label="본문 템플릿" />,
	},
};

/** 계정: 사람 표시, 이름과 주소, 끝에 버튼(가운데). */
export const Account: Story = {
	args: {
		align: "center",
		lead: <LetterMark person>하</LetterMark>,
		title: "김하늘",
		description: "haneul@example.com · 관리자",
		control: (
			<Button variant="secondary">
				<Logout aria-hidden />
				로그아웃
			</Button>
		),
	},
};

/** 지우는 일: 위험색 테두리 상자. */
export const Danger: Story = {
	args: {
		tone: "danger",
		title: "컬렉션 지우기",
		description: "‘글’ 26편과 필드 22개가 휴지통으로 갑니다. 30일 안에 되살릴 수 있습니다.",
		control: (
			<Button variant="outline-danger">
				<TrashCan aria-hidden />
				지우기…
			</Button>
		),
	},
};
