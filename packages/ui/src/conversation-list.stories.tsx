import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConversationGroupLabel, ConversationList, ConversationRow, ConversationRowMore } from "./conversation-list";

/** The assistant's past conversations by day: what was asked, when, and what came of it. The ⋯ opens a menu with 지우기. */
const meta = {
	title: "Monti/Assistant/ConversationList",
	component: ConversationList,
	decorators: [
		(Story) => (
			<div className="flex h-[520px] w-[380px] flex-col bg-monti-tool">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ConversationList>;
export default meta;
type Story = StoryObj<typeof meta>;

const more = <ConversationRowMore aria-label="대화 메뉴" />;

export const Days: Story = {
	render: () => (
		<ConversationList>
			<ConversationGroupLabel>오늘</ConversationGroupLabel>
			<ConversationRow title="더 짧게 다듬어 줘. 말투는 그대로." meta="10:58 · 첫 번째 글" menu={more} />
			<ConversationRow title="이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고…" meta="10:52" menu={more} />
			<ConversationGroupLabel>이전</ConversationGroupLabel>
			<ConversationRow current title="쓰지 않는 태그 정리해 줘" meta="10. 24" menu={more} />
			<ConversationRow title="이 글 영어로 옮겨 줘" meta="10. 22 · 첫 번째 글" menu={more} />
			<ConversationRow title="지난달 많이 읽힌 글 알려 줘" meta="10. 03" menu={more} />
		</ConversationList>
	),
};
