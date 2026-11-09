import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileBlock, Stack } from "./index";

/** A file in the body of an entry: a one-line box with the file icon, the name, and the kind and size in mono at the end. */
const meta = {
	title: "Patterns/Frame/FileBlock",
	component: FileBlock,
	args: { name: "annual-report.pdf", meta: "PDF · 1.2 MB" },
	render: (args) => (
		<Stack width="content">
			<FileBlock {...args} />
		</Stack>
	),
} satisfies Meta<typeof FileBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const File: Story = {};

/** Selected in the text: one thing, chosen whole. */
export const Selected: Story = { args: { name: "2026 연간 보고서", meta: "PDF · 1.2 MB", selected: true } };

/** A file that cannot be found. */
export const Missing: Story = { args: { name: "old-brochure.pdf", meta: "찾을 수 없어요", tone: "danger" } };
