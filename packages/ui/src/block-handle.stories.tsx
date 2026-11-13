import type { Meta, StoryObj } from "@storybook/react-vite";
import { Block, BlockHandle, PickBox, Stack, Text } from "./index";

/**
 * The grip in the left margin of a block: a 20 × 24 rounded square, a light ground when pointed at. While the block menu is open the grip stays
 * pressed and the block takes the block background.
 */
const meta = {
	title: "Monti/EditorTools/BlockHandle",
	component: BlockHandle,
	args: { gripLabel: "블록 메뉴" },
} satisfies Meta<typeof BlockHandle>;
export default meta;
type Story = StoryObj<typeof meta>;

const Paragraph = ({ active = false }) => (
	<Block active={active}>
		<Text as="p" variant="reading">
			Monti는 글을 쓰는 사람이 설정 파일을 열지 않아도 사이트를 고칠 수 있게 합니다.
		</Text>
	</Block>
);

export const Default: Story = {
	render: (args) => (
		<Stack direction="row" gap={8} align="start" maxWidth="reading">
			<BlockHandle {...args} />
			<Paragraph />
		</Stack>
	),
};

/** The block menu is open (`active`): the grip is pressed and the block has the block background. */
export const MenuOpen: Story = {
	render: (args) => (
		<Stack direction="row" gap={8} align="start" maxWidth="reading">
			<BlockHandle {...args} active />
			<Paragraph active />
		</Stack>
	),
};

/** The box a drag from the margin draws to pick blocks: a thin line only, the blocks under it on their own picked ground. */
export const Box: Story = {
	render: () => (
		// design-allow: the size the editor gives the box as the mouse goes
		<div style={{ width: 320, height: 96 }}>
			<PickBox />
		</div>
	),
};
