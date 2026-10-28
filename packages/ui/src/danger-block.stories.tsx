import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { DangerBlock, DangerRow } from "./danger-block";

/**
 * The step at the bottom of a settings tab that deletes something with its data. The rule above and the title are in the danger ink. Pressing the
 * button strikes the name through (the same look as the struck row in the collection list) and turns the button into the one that takes it back.
 */
const meta = {
	title: "Primitives/DangerBlock",
	component: DangerBlock,
	args: { title: "컬렉션 지우기", children: null },
	decorators: [
		(Story) => (
			<div className="max-w-[720px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DangerBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<DangerBlock {...args}>
			<DangerRow
				name="메모"
				meta="글 23편 · 휴지통 2편 포함"
				action={
					<Button variant="outline-danger" size="sm">
						지우기
					</Button>
				}
			/>
		</DangerBlock>
	),
};

/** After the button was pressed: the name is struck through and faint, its counts stay, and the button takes it back. */
export const Removed: Story = {
	render: (args) => (
		<DangerBlock {...args}>
			<DangerRow
				name="메모"
				meta="글 23편 · 휴지통 2편 포함"
				removed
				action={
					<Button variant="secondary" size="sm">
						되돌리기
					</Button>
				}
			/>
		</DangerBlock>
	),
};
