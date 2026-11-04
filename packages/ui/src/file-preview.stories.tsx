import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilePreview, Stack } from "./index";

/** What a tile shows for a file with no picture: a 20px file icon and the extension under it in mono. */
const meta = {
	title: "Patterns/List/FilePreview",
	component: FilePreview,
	args: { ext: "PDF" },
} satisfies Meta<typeof FilePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** `framed`: its own 4:3 box, for a panel's preview. Inside a tile, the tile gives the box. */
export const Framed: Story = {
	render: (args) => (
		<Stack width="menu">
			<FilePreview {...args} framed />
		</Stack>
	),
};
