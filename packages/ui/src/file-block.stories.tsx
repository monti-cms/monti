import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FileBlock } from "./file-block";
import { FilePreview } from "./file-preview";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";
import { Tile } from "./tile";

/**
 * A file in the body of an entry: the file icon, the name, and the kind and size in mono at the end. With `onNameChange` the name is a field that
 * reads as text.
 */
const meta = {
	title: "Monti/EditorTools/FileBlock",
	component: FileBlock,
	args: { name: "price-list-2026.pdf", meta: "PDF · 1.2 MB", "aria-label": "파일 price-list-2026.pdf" },
	decorators: [
		(Story) => (
			<div className="max-w-xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof FileBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => {
		const [name, setName] = useState("");
		return (
			<Stack gap={16}>
				<StoryCaption>Name edited in place (empty: the file's own name)</StoryCaption>
				<FileBlock
					name={name}
					placeholder="price-list-2026.pdf"
					nameLabel="보일 이름"
					onNameChange={setName}
					meta="PDF · 1.2 MB"
				/>
				<StoryCaption>Long name</StoryCaption>
				<FileBlock name="2026-spring-price-list-for-wholesale-partners-final-v3-revised.pdf" meta="PDF · 1.2 MB" />
				<StoryCaption>Not found</StoryCaption>
				<FileBlock name="" placeholder="파일" meta="파일을 찾을 수 없음" tone="danger" />
			</Stack>
		);
	},
};

/** The file in a tile: the icon and the extension on the tile ground; failed goes fainter. */
export const InTile: Story = {
	render: () => (
		<div className="grid w-96 grid-cols-2 gap-monti-16">
			<Tile preview={<FilePreview ext="PDF" />} title="price-list-2026.pdf" detail="PDF · 1.2 MB" />
			<Tile
				preview={<FilePreview ext="EXE" />}
				title="setup.exe"
				detail="이미지 · PDF · ZIP · 텍스트만"
				status="failed"
				actions={[{ label: "빼기", onClick: () => {} }]}
			/>
		</div>
	),
};
