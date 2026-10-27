import type { Meta, StoryObj } from "@storybook/react-vite";
import { Marker } from "./marker";
import { TodoDone, TodoItem } from "./todo-item";

/**
 * One row of the list a status bar cell opens: a ring, the title, one short line (where it is), and the one action that goes to it at the right.
 * A red ring blocks publishing, a spark before the action means the assistant does it, and a marker replaces the ring for a block whose source
 * changed. A ✓ line under the rows is what is already right.
 */
const meta = {
	title: "Status/TodoItem",
	component: TodoItem,
	args: {
		title: "대표 이미지가 없어요",
		detail: "검색 결과에 이미지 없이 보여요",
		actionLabel: "고르기",
		onAction: () => {},
	},
	decorators: [
		(Story) => (
			<div className="flex w-85 flex-col rounded-monti-xl border border-monti-emphasis bg-monti-page p-monti-6 shadow-monti-floating">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof TodoItem>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A warning ring is something to look at; a red one stops publishing. */
export const Blocking: Story = {
	render: () => (
		<>
			<TodoItem blocking title="제목이 비어 있어요" detail="제목" actionLabel="이동" onAction={() => {}} />
			<TodoItem title="링크 하나가 끊겼어요" detail="/posts/old-title" actionLabel="이동" onAction={() => {}} />
		</>
	),
};

/** The assistant does the action: a spark first, and the action in the proposal blue. */
export const AssistantAction: Story = { args: { proposal: true } };

/** A translated block whose source changed: the ring is a marker, and the row whose place is open is shaded. */
export const SourceChange: Story = {
	render: () => (
		<>
			<TodoItem
				marker={<Marker tone="changed">바뀜</Marker>}
				current
				title="문단 2"
				detail="접어 두고 필요할 때 펼친다."
				actionLabel="다시 번역"
				proposal
				onAction={() => {}}
			/>
			<TodoItem
				marker={<Marker tone="changed">지워짐</Marker>}
				title="문단 7"
				detail="원문에서 지워진 블록"
				actionLabel="지우기"
				onAction={() => {}}
			/>
		</>
	),
};

/** With `onOpen` the title and the line are a button that spreads over the row and goes to the place; the action stays its own button. */
export const GoesToPlace: Story = { args: { onOpen: () => {} } };

/** A long title and a long line are cut to one line each; the action keeps its place. */
export const LongText: Story = {
	args: {
		blocking: true,
		title: "아주 긴 제목의 항목이 한 줄 안에서 어떻게 보이는지 확인합니다",
		detail: "아주 긴 설명이 한 줄 안에서 잘리는지 확인하기 위한 문장입니다 아주 긴 설명이 한 줄 안에서 잘리는지",
		actionLabel: "이동",
	},
};

/** What is already right sits under the rows. */
export const Done: Story = {
	render: () => (
		<>
			<TodoItem title="요약이 비어 있어요" detail="요약" actionLabel="이동" onAction={() => {}} />
			<TodoDone>제목, 주소, 대표 이미지 확인함</TodoDone>
		</>
	),
};
