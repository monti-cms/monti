import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Suggest, SuggestLabel, SuggestList } from "./index";

/**
 * The assistant's empty panel: no explanation, only requests to start from at the bottom, over the box to type in. First this screen's default
 * requests (a spark), then "최근" (a clock).
 */
const meta = {
	title: "Monti/Assistant/Suggest",
	component: Suggest,
	args: { kind: "request", children: "요약이 빈 글 채우기" },
	decorators: [
		(Story) => (
			<Box width="assistant" height="screen" background="tool">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof Suggest>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyPanel: Story = {
	render: () => (
		<SuggestList>
			<SuggestLabel>이 목록에서</SuggestLabel>
			<Suggest kind="request">요약이 빈 글 채우기</Suggest>
			<Suggest kind="request">발행 후 고친 글 다듬기</Suggest>
			<Suggest kind="request">폴더 없는 글 정리하기</Suggest>
			<SuggestLabel>최근</SuggestLabel>
			<Suggest kind="recent">가을 여행 글에 태그 달아 줘</Suggest>
			<Suggest kind="recent">대체 텍스트 없는 이미지 찾아 줘</Suggest>
		</SuggestList>
	),
};

/** Nothing asked before: only the default requests. */
export const WithoutRecent: Story = {
	render: () => (
		<SuggestList>
			<SuggestLabel>미디어에서</SuggestLabel>
			<Suggest kind="request">대체 텍스트 채우기</Suggest>
			<Suggest kind="request">쓰지 않는 파일 찾기</Suggest>
		</SuggestList>
	),
};
