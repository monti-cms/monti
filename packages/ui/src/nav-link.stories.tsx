import type { Meta, StoryObj } from "@storybook/react-vite";
import { DragHandle, NavLink, Stack } from "./index";

/** One link of a page's own navigation (the collections beside the settings editor): the rail's row on paper, the identifier at the end in mono. */
const meta = {
	title: "Patterns/Frame/NavLink",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The open one on the current ground and semibold; one with an unsaved change has a dot after its name; with a handle it can be dragged. */
export const Links: Story = {
	render: () => (
		<Stack as="nav" gap={2} width="sidebar" aria-label="컬렉션">
			<NavLink active note="posts" onSelect={() => {}} handle={<DragHandle aria-label="끌어서 옮기기" />}>
				게시글
			</NavLink>
			<NavLink
				note="notes"
				dot="저장하지 않은 변경"
				onSelect={() => {}}
				handle={<DragHandle aria-label="끌어서 옮기기" />}
			>
				노트
			</NavLink>
			<NavLink note="tags" onSelect={() => {}} handle={<DragHandle aria-label="끌어서 옮기기" />}>
				태그
			</NavLink>
		</Stack>
	),
};
