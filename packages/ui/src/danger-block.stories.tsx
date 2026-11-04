import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, DangerBlock, DangerRow, Stack } from "./index";

/** The step at the bottom of a settings tab that deletes something with its data: a danger rule above, the title in danger ink, and rows. */
const meta = {
	title: "Patterns/Frame/DangerBlock",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** One row: its name, what it holds, and the button at the end. */
export const Collection: Story = {
	render: () => (
		<Stack width="content">
			<DangerBlock title="컬렉션 삭제">
				<DangerRow
					name="게시글"
					meta="글 23개 · 휴지통에 2개"
					action={
						<Button variant="outline-danger" size="sm">
							삭제
						</Button>
					}
				/>
			</DangerBlock>
		</Stack>
	),
};
