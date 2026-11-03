import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	ChatAnswer,
	ChatDate,
	ChatMessage,
	ChatThread,
	ErrorNote,
	ProposalActions,
	ProposalCard,
	ProposalRow,
	TextButton,
	ToolCallLine,
	ToolCallLines,
} from "./index";

const noop = () => {};

/**
 * The conversation: messages 24px apart, sitting at the bottom of the panel over the box and stacking up. An answer holds its tool lines, text,
 * cards and error answers 12px apart. A conversation opened again on another day has its date at the top.
 */
const meta = {
	title: "Monti/Assistant/ChatThread",
	component: ChatThread,
	decorators: [
		(Story) => (
			<Box width="assistant" height="screen" background="tool">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ChatThread>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Conversation: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user">요약이 빈 글에 요약을 채워 줘</ChatMessage>
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="완료">
						글 목록 읽음 · 게시글 148편
					</ToolCallLine>
					<ToolCallLine status="done" statusLabel="완료">
						글 11편 읽음
					</ToolCallLine>
				</ToolCallLines>
				<ChatMessage>요약이 빈 글 11편에 요약을 채운 제안을 만들었어요.</ChatMessage>
				<ProposalCard
					title="제안"
					summary="1묶음 · 11건"
					status="검토 대기"
					statusTone="warning"
					footer={
						<ProposalActions
							reviewLabel="상세 보기"
							onReview={noop}
							discardLabel="버리기"
							onDiscard={noop}
							applyLabel="11건 적용"
							onApply={noop}
						/>
					}
				>
					<ProposalRow name="요약 채우기" detail="요약이 빈 글" count="11편" />
				</ProposalCard>
			</ChatAnswer>
		</ChatThread>
	),
};

/** Opened again on another day: the date at the top. */
export const Reopened: Story = {
	render: () => (
		<ChatThread>
			<ChatDate>10. 24 (금)</ChatDate>
			<ChatMessage author="user">가을 여행 글에 태그 달아 줘</ChatMessage>
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="완료">
						글 읽음 · 가을 여행 기록
					</ToolCallLine>
				</ToolCallLines>
				<ChatMessage>“가을”, “산”, “걷기” 태그를 달았어요.</ChatMessage>
			</ChatAnswer>
		</ChatThread>
	),
};

/** Working: the running line, then the answer as it comes. */
export const Working: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user" context="고른 글 2편">
				이 글들을 다듬어 줘
			</ChatMessage>
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="완료">
						글 2편 읽음
					</ToolCallLine>
					<ToolCallLine status="running" statusLabel="하는 중">
						문장 다듬는 중
					</ToolCallLine>
				</ToolCallLines>
				<ChatMessage streaming>첫 글의 문장 세 곳을</ChatMessage>
			</ChatAnswer>
		</ChatThread>
	),
};

/** Stopped: the line that stopped is red, and the error answer offers to go on. */
export const Stopped: Story = {
	render: () => (
		<ChatThread>
			<ChatMessage author="user">폴더 없는 글을 2024 폴더로 옮겨 줘</ChatMessage>
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="완료">
						글 목록 읽음 · 폴더 없는 글 4편
					</ToolCallLine>
					<ToolCallLine status="failed" statusLabel="실패">
						글 옮기기 · 여기서 멈춤
					</ToolCallLine>
				</ToolCallLines>
				<ErrorNote title="연결이 끊겼어요" actions={<TextButton>이어서 하기</TextButton>}>
					여기까지 한 일은 위에 남아 있어요.
				</ErrorNote>
			</ChatAnswer>
		</ChatThread>
	),
};
