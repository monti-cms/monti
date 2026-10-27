import type { Meta, StoryObj } from "@storybook/react-vite";
import { Marker } from "./marker";
import { SheetList, TodoDone, TodoItem } from "./sheet-list";

/**
 * The list a status bar cell opens upward: the group's name and count, then what needs fixing (a ring, a title, one line, one action) and what
 * is already right. A red ring blocks publishing; a spark before the action means the assistant does it.
 */
const meta = {
	title: "Overlays/SheetList",
	component: SheetList,
	args: {
		label: "고칠 것",
		count: 3,
		trigger: <button type="button">고칠 것 3</button>,
		defaultOpen: true,
		children: null,
	},
	decorators: [
		(Story) => (
			<div className="flex min-h-96 items-end">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SheetList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<SheetList {...args} countTone="danger">
			<TodoItem blocking title="제목이 비어 있어요" detail="제목" actionLabel="이동" onAction={() => {}} />
			<TodoItem
				blocking
				title="주소가 다른 글과 같아요"
				detail="/posts/first-post"
				actionLabel="이동"
				onAction={() => {}}
			/>
			<TodoItem
				title="대표 이미지가 없어요"
				detail="검색 결과에 이미지 없이 보여요"
				proposal
				actionLabel="고르기"
				onAction={() => {}}
			/>
			<TodoDone>요약, 태그 확인함</TodoDone>
		</SheetList>
	),
};

/** Warning rings only: nothing stops publishing. */
export const WarningsOnly: Story = {
	args: { count: 2 },
	render: (args) => (
		<SheetList {...args}>
			<TodoItem title="번역이 일부만 채워졌어요" detail="영어 · 문단 3개" actionLabel="열기" onAction={() => {}} />
			<TodoItem title="링크 하나가 끊겼어요" detail="/posts/old-title" actionLabel="이동" onAction={() => {}} />
		</SheetList>
	),
};

/** Blocks of a translation whose source changed: the ring is a marker (changed, new, removed), and the row whose place is open is shaded. */
export const SourceChanges: Story = {
	args: { label: "원문에서 바뀐 곳", count: 3 },
	render: (args) => (
		<SheetList {...args}>
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
				marker={<Marker tone="changed">새로</Marker>}
				title="문단 5"
				detail="원문에 새로 생긴 블록"
				actionLabel="번역"
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
		</SheetList>
	),
};

/** A long title and a long line are cut to one line each; the action keeps its place. */
export const LongText: Story = {
	args: { count: 1 },
	render: (args) => (
		<SheetList {...args}>
			<TodoItem
				blocking
				title="아주 긴 제목의 항목이 한 줄 안에서 어떻게 보이는지 확인합니다"
				detail="아주 긴 설명이 한 줄 안에서 잘리는지 확인하기 위한 문장입니다 아주 긴 설명이 한 줄 안에서 잘리는지"
				actionLabel="이동"
				onAction={() => {}}
			/>
		</SheetList>
	),
};

/** Nothing left to fix: only what is done. */
export const AllDone: Story = {
	args: { count: 0 },
	render: (args) => (
		<SheetList {...args}>
			<TodoDone>제목, 주소, 대표 이미지 확인함</TodoDone>
		</SheetList>
	),
};
