import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
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

/** The name changed in place: a field that reads as text; the file's own name shows while it is empty. */
export const Rename: Story = {
	render: function Render(args) {
		const [name, setName] = useState("2026 연간 보고서");
		return (
			<Stack width="content">
				<FileBlock
					{...args}
					name={name}
					onNameChange={setName}
					placeholder="annual-report.pdf"
					nameLabel="보이는 이름"
				/>
			</Stack>
		);
	},
};

/** A file that cannot be found. */
export const Missing: Story = { args: { name: "old-brochure.pdf", meta: "찾을 수 없어요", tone: "danger" } };
