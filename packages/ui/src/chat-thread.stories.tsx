import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatError } from "./chat-error";
import { ChatMessage } from "./chat-message";
import { ChatAnswer, ChatDate, ChatThread, ToolCallLines } from "./chat-thread";
import { TextButton } from "./text-button";
import { ToolCallLine } from "./tool-call-line";

/** The conversation of the assistant panel: messages 24px apart, sitting at the bottom of the panel over the box to type in. */
const meta = {
	title: "Monti/Assistant/Thread",
	component: ChatThread,
	decorators: [
		(Story) => (
			<div className="flex h-[640px] w-[380px] flex-col bg-monti-tool">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ChatThread>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A question, the tool lines while the assistant works, and the answer. */
export const Answered: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="완료">
						글 목록 읽음 · 게시글 148편
					</ToolCallLine>
					<ToolCallLine status="done" statusLabel="완료">
						목록 거름 · 요약 비어 있음
					</ToolCallLine>
				</ToolCallLines>
				<ChatMessage>요약이 빈 글은 두 편이에요. 목록을 그 두 편으로 걸렀어요.</ChatMessage>
			</ChatAnswer>
		</ChatThread>
	),
};

/** Cut off while working: how far it got, and a way to go on. */
export const Cut: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="완료">
						글 목록 읽음 · 게시글 148편
					</ToolCallLine>
					<ToolCallLine status="failed" statusLabel="멈춤">
						글 읽기 · 여기서 멈춤
					</ToolCallLine>
				</ToolCallLines>
				<ChatError
					title="연결이 끊겼어요"
					actions={
						<TextButton type="button" variant="underline">
							이어서 하기
						</TextButton>
					}
				>
					한 일은 위에 남아 있어요.
				</ChatError>
			</ChatAnswer>
		</ChatThread>
	),
};

/** A conversation opened again from another day: the day over its messages. */
export const AnotherDay: Story = {
	render: () => (
		<ChatThread>
			<ChatDate>10. 24 (금)</ChatDate>
			<ChatMessage author="user">쓰지 않는 태그 정리해 줘</ChatMessage>
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="완료">
						태그 읽음 · 38개
					</ToolCallLine>
				</ToolCallLines>
				<ChatMessage>글에 한 번도 안 쓰인 태그가 4개예요.</ChatMessage>
			</ChatAnswer>
		</ChatThread>
	),
};
