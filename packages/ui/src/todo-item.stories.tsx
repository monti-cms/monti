import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, TodoDone, TodoItem } from "./index";

const noop = () => {};

/**
 * One thing to fix in the list a status bar cell opens: a ring, the title, one line saying where, and one action. Red ring for what stops publishing,
 * a spark and blue for the assistant's action; things already right are ✓ rows under a rule.
 */
const meta = {
	title: "Monti/EditorTools/TodoItem",
	component: TodoItem,
	args: { title: "요약 쓰기" },
	decorators: [
		(Story) => (
			<Box width="panel" padding={6} background="page" border="all" radius="lg">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof TodoItem>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The assistant's action: a spark and blue. */
export const Default: Story = {
	args: {
		title: "요약 쓰기",
		detail: "요약 · 비어 있음",
		onOpen: noop,
		actionLabel: "채우기",
		onAction: noop,
		proposal: true,
	},
};

/** Stops publishing: the ring is red. */
export const Blocking: Story = {
	render: () => (
		<TodoItem
			title="대표 이미지 고르기"
			detail="대표 이미지 · 비어 있음"
			blocking
			onOpen={noop}
			actionLabel="고르기"
			onAction={noop}
		/>
	),
};

/** The same problem grouped in one row, the places on the line under it. */
export const Grouped: Story = {
	render: () => (
		<TodoItem
			title="대체 텍스트 없는 이미지 2개"
			detail="본문 1 · 본문 2"
			onOpen={noop}
			actionLabel="채우기"
			onAction={noop}
			proposal
		/>
	),
};

/** The row whose place is open on the page. */
export const Current: Story = {
	render: () => (
		<TodoItem
			title="요약 쓰기"
			detail="요약 · 비어 있음"
			current
			onOpen={noop}
			actionLabel="채우기"
			onAction={noop}
			proposal
		/>
	),
};

/** Translated blocks whose source moved: the word in front instead of the ring, in the colors the changes lists use, the title cut to one line. */
export const WithTag: Story = {
	render: () => (
		<>
			<TodoItem
				title="I rebuilt the blog because fixing the tool took longer than writing."
				tag="변경"
				onOpen={noop}
				actionLabel="확인"
				onAction={noop}
			/>
			<TodoItem
				title="The list keeps only the title, the address and the state."
				tag="지워짐"
				tagTone="danger"
				onOpen={noop}
				actionLabel="지우기"
				onAction={noop}
			/>
			<TodoItem
				title="다음 글에서는 번역을 다룬다."
				tag="추가"
				tagTone="success"
				onOpen={noop}
				actionLabel="빼기"
				onAction={noop}
			/>
		</>
	),
};

/** The list: rows to fix, then what is already right under a rule. */
export const WithDone: Story = {
	render: () => (
		<>
			<TodoItem
				title="요약 쓰기"
				detail="요약 · 비어 있음"
				onOpen={noop}
				actionLabel="채우기"
				onAction={noop}
				proposal
			/>
			<TodoItem
				title="대표 이미지 고르기"
				detail="대표 이미지 · 비어 있음"
				blocking
				onOpen={noop}
				actionLabel="고르기"
				onAction={noop}
			/>
		</>
	),
};

/** Nothing left to fix: one line that says so. Done things are not listed. */
export const AllDone: Story = {
	render: () => <TodoDone>할 일 없음</TodoDone>,
};
