import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatMessage, ChatThread, ErrorNote, Stack, Text, TextButton, ToolCallLine } from "./index";

/**
 * The assistant's conversation: requests and what answered them, 24px apart, at the foot of the panel. Inside an answer the screen spaces its
 * tool lines (no gap), its words and its card with `Stack`, 12px apart.
 */
const meta = {
	title: "Monti/Assistant/ChatThread",
	component: ChatThread,
	decorators: [
		(Story) => (
			<Stack width="assistant" height="screen" background="tool">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof ChatThread>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A request, the tool lines of its answer, and the answer's words. */
export const Conversation: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user" context="이 목록">
				요약이 비어 있는 글 찾아 줘
			</ChatMessage>
			<Stack gap={12}>
				<Stack gap={0}>
					<ToolCallLine status="done" statusLabel="끝남">
						글 목록 읽음 · 148편
					</ToolCallLine>
				</Stack>
				<ChatMessage>요약이 비어 있는 글은 2편입니다.</ChatMessage>
			</Stack>
		</ChatThread>
	),
};

/** The model no longer has the oldest requests: a quiet line stands over the first one it still has. */
export const Remembered: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user">지난주에 쓴 글 목록 보여 줘</ChatMessage>
			<ChatMessage>세 편입니다.</ChatMessage>
			<Text as="div" variant="micro" tone="subtle" align="center">
				여기부터 기억합니다
			</Text>
			<ChatMessage author="user">그중에 초안만</ChatMessage>
			<ChatMessage>초안은 한 편입니다.</ChatMessage>
		</ChatThread>
	),
};

/** Working: a tool line that is going, and the caret where the answer's words will come. */
export const Working: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
			<Stack gap={12}>
				<Stack gap={0}>
					<ToolCallLine status="done" statusLabel="끝남">
						글 목록 읽음 · 148편
					</ToolCallLine>
					<ToolCallLine status="running" statusLabel="하는 중">
						글 읽는 중 · 62 / 148
					</ToolCallLine>
				</Stack>
			</Stack>
		</ChatThread>
	),
};

/** A run that did not finish: what was done stays, the call it stopped at says so, and a note holds what can be done. */
export const Stopped: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
			<Stack gap={12}>
				<Stack gap={0}>
					<ToolCallLine status="done" statusLabel="끝남">
						글 목록 읽음 · 148편
					</ToolCallLine>
					<ToolCallLine status="failed" statusLabel="실패">
						글 · 여기서 멈춤
					</ToolCallLine>
				</Stack>
				<ErrorNote title="연결이 끊겼습니다" actions={<TextButton variant="underline">이어서 하기</TextButton>} />
			</Stack>
		</ChatThread>
	),
};
