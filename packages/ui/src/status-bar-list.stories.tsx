import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, StatusBar, StatusBarCell, StatusBarList, StatusBarListGroup, TodoDone, TodoItem } from "./index";

/** The list that opens upward from a status bar cell: the group's name and count, the rows to do, the ones done, and actions under a rule. */
const meta = {
	title: "Patterns/Frame/StatusBarList",
	parameters: { bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const bar = (list: React.ReactNode) => <StatusBar aria-label="상태">{list}</StatusBar>;

/** To do: a row that blocks publishing makes the count red; an assistant's action is blue. */
export const Todo: Story = {
	render: () =>
		bar(
			<StatusBarList
				trigger={<StatusBarCell tone="danger">할 일 3</StatusBarCell>}
				label="할 일"
				count={3}
				countTone="danger"
				defaultOpen
				footer={
					<>
						<Button variant="ghost" size="sm">
							설정
						</Button>
						<Button variant="ghost" size="sm">
							모두 고치기
						</Button>
					</>
				}
			>
				<TodoItem title="표지 이미지 없음" detail="발행에 필요" blocking onOpen={() => {}} />
				<TodoItem title="요약 · 비어 있음" proposal actionLabel="채우기" onAction={() => {}} />
				<TodoItem title="검색 제목 60자 넘음" detail="68자" onOpen={() => {}} />
				<TodoDone>주소 정함</TodoDone>
			</StatusBarList>,
		),
};

/** Nothing left: no count. */
export const Done: Story = {
	render: () =>
		bar(
			<StatusBarList trigger={<StatusBarCell>할 일</StatusBarCell>} label="할 일" count={0} defaultOpen>
				<TodoDone>표지 이미지 있음</TodoDone>
				<TodoDone>요약 채움</TodoDone>
			</StatusBarList>,
		),
};

/** A translation's to-do list: what stops publishing, then what changed in the source as a second group; each change row is left as it is or pressed to go there. */
export const WithSourceChanges: Story = {
	render: () =>
		bar(
			<StatusBarList
				trigger={<StatusBarCell tone="warning">할 일 3</StatusBarCell>}
				label="발행 전에 고칠 것"
				count={1}
				defaultOpen
			>
				<TodoItem title="본문" detail="흐린 블록 1" blocking onOpen={() => {}} />
				<StatusBarListGroup label="원문 변경" count={2}>
					<TodoItem title="제목" tag="변경" actionLabel="번역 유지" onAction={() => {}} onOpen={() => {}} />
					<TodoItem
						title="What I took out"
						tag="삭제"
						tagTone="danger"
						actionLabel="지우기"
						onAction={() => {}}
						onOpen={() => {}}
					/>
				</StatusBarListGroup>
			</StatusBarList>,
		),
};
