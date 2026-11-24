import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { DragHandle } from "./drag-handle";
import { IconButton } from "./icon-button";
import { Add, OverflowMenuHorizontal } from "./icons";
import { LanguageList, LanguageListAdd, LanguageListFlag, LanguageListNote, LanguageListRow } from "./language-list";
import { Stack } from "./stack";

/** 설정 › 언어의 목록: 테두리 상자 안에 원문 줄, 번역 줄, 맨 아래 "+ 언어 추가". */
const meta = {
	title: "Patterns/List/LanguageList",
	component: LanguageList,
	decorators: [
		(Story) => (
			<Stack className="max-w-2xl">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof LanguageList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<LanguageList aria-label="콘텐츠 언어">
			<LanguageListRow source name="한국어" code="ko">
				<LanguageListFlag>원문</LanguageListFlag>
				<Button variant="ghost" size="sm">
					원문 바꾸기
				</Button>
			</LanguageListRow>
			<LanguageListRow name="English" code="en" label="영어" handle={<DragHandle aria-label="English 옮기기" />}>
				<LanguageListNote>번역 24 / 26</LanguageListNote>
				<IconButton size="sm" label="English 더 보기">
					<OverflowMenuHorizontal aria-hidden />
				</IconButton>
			</LanguageListRow>
			<LanguageListAdd>
				<Add aria-hidden />
				언어 추가
			</LanguageListAdd>
		</LanguageList>
	),
};
