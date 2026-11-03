import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	ConversationGroupLabel,
	ConversationList,
	ConversationRow,
	ConversationRowMore,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./index";

/**
 * Past conversations in the panel: grouped "오늘" and "이전", each row the first words asked and the time in mono under them. The open one has the
 * selected ground; pointing at a row shows its ⋯ with "지우기".
 */
const meta = {
	title: "Monti/Assistant/ConversationList",
	component: ConversationList,
	decorators: [
		(Story) => (
			<Box width="assistant" height="screen" background="tool">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ConversationList>;
export default meta;
type Story = StoryObj<typeof meta>;

const More = () => (
	<DropdownMenu>
		<DropdownMenuTrigger render={<ConversationRowMore aria-label="대화 메뉴" />} />
		<DropdownMenuContent align="end">
			<DropdownMenuItem variant="danger">지우기</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
);

export const Default: Story = {
	render: () => (
		<ConversationList>
			<ConversationGroupLabel>오늘</ConversationGroupLabel>
			<ConversationRow title="요약이 빈 글에 요약을 채워 줘" meta="10:58" current menu={<More />} />
			<ConversationRow title="대체 텍스트 없는 이미지 찾아 줘" meta="09:12" menu={<More />} />
			<ConversationGroupLabel>이전</ConversationGroupLabel>
			<ConversationRow title="가을 여행 글에 태그 달아 줘" meta="10. 24" menu={<More />} />
			<ConversationRow
				title="발행 후 고친 글의 문장을 다듬고 맞춤법과 띄어쓰기를 바로잡아 줘"
				meta="10. 21"
				menu={<More />}
			/>
		</ConversationList>
	),
};
