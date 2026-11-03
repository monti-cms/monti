import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBar, StatusBarCell, StatusBarList, TextButton, TodoDone, TodoItem } from "./index";

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
						<TextButton>설정</TextButton>
						<TextButton>모두 고치기</TextButton>
					</>
				}
			>
				<TodoItem title="표지 이미지가 없어요" detail="발행하려면 필요해요" blocking onOpen={() => {}} />
				<TodoItem title="요약이 비어 있어요" proposal actionLabel="채우기" onAction={() => {}} />
				<TodoItem title="검색 제목이 60자를 넘어요" detail="68자" onOpen={() => {}} />
				<TodoDone>주소가 정해졌어요</TodoDone>
			</StatusBarList>,
		),
};

/** Nothing left: no count. */
export const Done: Story = {
	render: () =>
		bar(
			<StatusBarList trigger={<StatusBarCell>할 일</StatusBarCell>} label="할 일" count={0} defaultOpen>
				<TodoDone>표지 이미지가 있어요</TodoDone>
				<TodoDone>요약을 채웠어요</TodoDone>
			</StatusBarList>,
		),
};
